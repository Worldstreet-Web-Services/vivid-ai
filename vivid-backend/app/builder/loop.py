"""One builder turn: the model call, its tool calls, the step cap, and the
one retry on the fallback model.

`TurnRunner.run()` is an async generator of UI Message Stream parts (see
stream.py). The route frames them for the wire and folds them into stored
parts; the eval script counts them. Nothing here knows about HTTP or the
database.

The shape follows services/code_agent.py: messages are appended only when a
model call completes, so a broken stream leaves the conversation valid, and
a tool result is always paired with the assistant turn that asked for it.
"""
import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import AsyncIterator, Callable

from app.builder import context, prompt, routing, stream, tools
from app.builder.sandbox.base import Sandbox
from app.core.config import settings
from app.services.models_gateway import code_llm, provider
from app.services.models_gateway.code_llm import CodeLLMUnavailable

log = logging.getLogger("vivid.builder.loop")

ANSWERED = "answered"
STEP_LIMIT = "step_limit"
TYPECHECK_STRIKES = "typecheck_strikes"
CANCELLED = "cancelled"
ERROR = "error"

#: Attempt outcomes that earn a retry on the fallback model.
RETRYABLE = {STEP_LIMIT, TYPECHECK_STRIKES}

RETRY_NOTICE = "Retrying with a different model."


@dataclass
class ModelCall:
    """One model request, for the usage ledger."""
    model: str
    stage: str
    usage: dict | None


@dataclass
class TurnResult:
    reason: str = ERROR
    steps: int = 0
    #: Slug of the model that produced the final answer.
    model: str = ""
    calls: list[ModelCall] = field(default_factory=list)
    touched: list[str] = field(default_factory=list)
    typecheck_failures: int = 0
    retried: bool = False

    @property
    def tokens_in(self) -> int:
        return sum((c.usage or {}).get("prompt_tokens", 0) for c in self.calls)

    @property
    def tokens_out(self) -> int:
        return sum((c.usage or {}).get("completion_tokens", 0) for c in self.calls)


class TurnRunner:
    def __init__(self, sandbox: Sandbox, stage: str, history: list[dict],
                 user_text: str, spec_md: str | None = None,
                 recent_files: list[str] | None = None,
                 cancelled: Callable[[], bool] = lambda: False,
                 message_id: str | None = None) -> None:
        self.sandbox = sandbox
        self.stage = stage
        self.history = history
        self.user_text = user_text
        self.spec_md = spec_md
        self.recent_files = recent_files or []
        self.cancelled = cancelled
        self.message_id = message_id or stream.new_id("msg")
        self.result = TurnResult()

    # ---------------------------------------------------------------- run
    async def run(self) -> AsyncIterator[dict]:
        yield stream.start(self.message_id)
        primary = routing.endpoint_for(self.stage)
        fallback = routing.endpoint_for(routing.FALLBACK)

        outcome = ERROR
        async for part in self._attempt(primary, self.stage):
            yield part
        outcome = self.result.reason

        if outcome in RETRYABLE and fallback.configured and fallback.model != primary.model:
            log.info("turn on %s ended with %s; retrying on %s",
                     primary.model, outcome, fallback.model)
            self.result.retried = True
            yield stream.data("notice", {"text": RETRY_NOTICE, "reason": outcome})
            text_id = stream.new_id("txt")
            yield stream.text_start(text_id)
            yield stream.text_delta(text_id, RETRY_NOTICE)
            yield stream.text_end(text_id)
            async for part in self._attempt(fallback, routing.FALLBACK):
                yield part
            outcome = self.result.reason

        if outcome in RETRYABLE:
            # Both models ran out of road. Say so in the thread rather than
            # ending on a tool result the user cannot read.
            text_id = stream.new_id("txt")
            yield stream.text_start(text_id)
            yield stream.text_delta(text_id, _exhausted_message(outcome))
            yield stream.text_end(text_id)

        yield stream.data("usage", {
            "model": self.result.model, "steps": self.result.steps,
            "tokens_in": self.result.tokens_in, "tokens_out": self.result.tokens_out,
            "reason": outcome,
        })
        yield stream.finish()

    # ------------------------------------------------------------ attempt
    async def _attempt(self, endpoint: provider.Endpoint, stage: str) -> AsyncIterator[dict]:
        """One model's try at the turn. Sets self.result.reason on exit."""
        self.result.model = endpoint.model
        block = await context.build(self.sandbox, self.recent_files)
        messages = [{"role": "system", "content": prompt.system_prompt(self.spec_md, block)}]
        messages += self.history
        messages.append({"role": "user", "content": self.user_text})

        strikes = 0
        for step in range(1, settings.BUILDER_MAX_STEPS + 1):
            if self.cancelled():
                yield stream.abort("cancelled by the user")
                self.result.reason = CANCELLED
                return
            self.result.steps += 1
            yield stream.start_step()

            text_id = stream.new_id("txt")
            started = False
            text_parts: list[str] = []
            calls: list[dict] = []
            try:
                async for ev in code_llm.stream_chat(
                        messages, tools.SCHEMAS, endpoint=endpoint,
                        max_tokens=settings.BUILDER_MAX_REPLY_TOKENS,
                        temperature=settings.BUILDER_TEMPERATURE):
                    if ev["type"] == "token":
                        if not started:
                            started = True
                            yield stream.text_start(text_id)
                        text_parts.append(ev["text"])
                        yield stream.text_delta(text_id, ev["text"])
                    elif ev["type"] == "tool_calls":
                        calls = ev["calls"]
                    elif ev["type"] == "done":
                        self.result.calls.append(
                            ModelCall(endpoint.model, stage, ev.get("usage")))
            except CodeLLMUnavailable as e:
                log.warning("builder model call failed: %s", e)
                if started:
                    yield stream.text_end(text_id)
                yield stream.error(e.public)
                self.result.reason = ERROR
                return
            if started:
                yield stream.text_end(text_id)
            text = "".join(text_parts).strip()

            if not calls:
                messages.append({"role": "assistant", "content": text})
                yield stream.finish_step()
                self.result.reason = ANSWERED
                return

            messages.append({
                "role": "assistant", "content": text or None,
                "tool_calls": [{"id": c["id"], "type": "function",
                                "function": {"name": c["name"],
                                             "arguments": json.dumps(c["arguments"])}}
                               for c in calls]})

            for call in calls:
                if self.cancelled():
                    yield stream.abort("cancelled by the user")
                    self.result.reason = CANCELLED
                    return
                yield stream.tool_input(call["id"], call["name"], call["arguments"])
                if call.get("error"):
                    content = f"error: {call['error']}. Call the tool again with valid JSON."
                    yield stream.tool_error(call["id"], content)
                else:
                    outcome = await tools.execute(call["name"], call["arguments"], self.sandbox)
                    content = outcome.text
                    if outcome.touched and outcome.touched not in self.result.touched:
                        self.result.touched.append(outcome.touched)
                    if outcome.typecheck_ok is False:
                        strikes += 1
                        self.result.typecheck_failures += 1
                    elif outcome.typecheck_ok is True:
                        strikes = 0
                    yield stream.tool_output(call["id"], content)
                messages.append({"role": "tool", "tool_call_id": call["id"],
                                 "name": call["name"], "content": content})
            yield stream.finish_step()

            if strikes >= settings.BUILDER_TYPECHECK_STRIKES:
                self.result.reason = TYPECHECK_STRIKES
                return

        self.result.reason = STEP_LIMIT


def _exhausted_message(reason: str) -> str:
    if reason == TYPECHECK_STRIKES:
        return ("I could not get the code to typecheck cleanly this turn. The "
                "preview may show an error; tell me what you see and I will fix it.")
    return ("I ran out of steps before finishing. Send another message to "
            "continue from here.")


class TurnRegistry:
    """Which projects have a turn in flight in this process, and the cancel
    flag for each. One turn per project at a time."""

    def __init__(self) -> None:
        self._events: dict[str, asyncio.Event] = {}

    def start(self, project_id: str) -> asyncio.Event | None:
        if project_id in self._events:
            return None
        event = asyncio.Event()
        self._events[project_id] = event
        return event

    def finish(self, project_id: str) -> None:
        self._events.pop(project_id, None)

    def cancel(self, project_id: str) -> bool:
        event = self._events.get(project_id)
        if event is None:
            return False
        event.set()
        return True

    def running(self, project_id: str) -> bool:
        return project_id in self._events


turns = TurnRegistry()
