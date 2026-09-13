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
import re
from dataclasses import dataclass, field
from typing import AsyncIterator, Awaitable, Callable

from app.builder import context, prompt, routing, screenshots, skills, stream, tools
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

#: Attempt outcomes that earn a retry on the fallback model. ERROR is the
#: primary's stream failing repeatedly; the fallback is another vendor.
RETRYABLE = {STEP_LIMIT, TYPECHECK_STRIKES, ERROR}

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
    critique_rounds: int = 0
    completion_rounds: int = 0
    #: Stored screenshot keys, newest round last.
    screenshots: list[str] = field(default_factory=list)

    @property
    def tokens_in(self) -> int:
        return sum((c.usage or {}).get("prompt_tokens", 0) for c in self.calls)

    @property
    def tokens_out(self) -> int:
        return sum((c.usage or {}).get("completion_tokens", 0) for c in self.calls)


STREAM_RETRY_NOTICE = "The model connection dropped; retrying."

CONTINUE_NUDGE = ("Go on and do it now with the tools; do not describe what you are about "
                  "to do. Reply to the user only when the work is complete.")

#: A final reply that says what comes next instead of what was done.
_INTENT = re.compile(
    r"(let me|let's|i['’]ll|i will|now i|next[, ]|i am going to|i'm going to|"
    r"going to (build|create|write|add|wire|set up)|then build|then i)\b[^.!?]*[.!]?\s*$",
    re.IGNORECASE)


def _announces_more_work(text: str) -> bool:
    tail = (text or "").strip()[-220:]
    return bool(tail) and bool(_INTENT.search(tail))

COMPLETION_BRIEF = """Before we show this to the user, review the app against the spec, page by \
page. Check: every page in the spec's Pages section exists, is routed, and is linked from the \
nav and footer; any admin or owner area exists at its own route behind a sign-in gate and is NOT \
linked from the customer nav (a footer "Owner sign in" link at most); each list has at least eight realistic \
seeded items with names, prices in the spec's currency, short descriptions and an image \
(generate_image for anything without an upload); each page has every section its recipe \
lists; every image path used in the code exists in public/uploads (list_files it; generate \
or fix any that do not, a broken image is worse than none); forms work end to end (add to \
cart, book, save); the footer has the real business details; the copy passes the copy \
skill's checks. list_files and read what you need, then build everything that is missing or thin \
now, in this turn. Do not shorten anything. When it is complete, reply to the user in one or \
two sentences about what the app now contains."""
#: Seconds before restarting a broken stream, multiplied by the attempt.
_RETRY_BACKOFF = 1.5


class ModelStep:
    """One model call streamed as parts, restarted whole if the stream
    breaks. Providers behind OpenRouter drop long responses often enough
    that a first build would fail one time in a handful without this.
    Restarting is safe: the conversation is not touched until the call
    completes, so a half-streamed reply leaves no trace. The prose the user
    already saw is closed with a notice."""

    def __init__(self, messages: list[dict], schemas: list[dict],
                 endpoint: provider.Endpoint) -> None:
        self.messages, self.schemas, self.endpoint = messages, schemas, endpoint
        self.text = ""
        self.calls: list[dict] = []
        self.usage: dict | None = None
        self.failed: CodeLLMUnavailable | None = None

    async def run(self) -> AsyncIterator[dict]:
        attempts = max(1, settings.CODE_STREAM_RETRIES)
        for attempt in range(1, attempts + 1):
            text_id, started, parts, calls, usage = stream.new_id("txt"), False, [], [], None
            try:
                async for ev in code_llm.stream_chat(
                        self.messages, self.schemas, endpoint=self.endpoint,
                        max_tokens=settings.BUILDER_MAX_REPLY_TOKENS,
                        temperature=settings.BUILDER_TEMPERATURE):
                    if ev["type"] == "token":
                        if not started:
                            started = True
                            yield stream.text_start(text_id)
                        parts.append(ev["text"])
                        yield stream.text_delta(text_id, ev["text"])
                    elif ev["type"] == "tool_calls":
                        calls = ev["calls"]
                    elif ev["type"] == "done":
                        usage = ev.get("usage")
            except CodeLLMUnavailable as e:
                if started:
                    yield stream.text_end(text_id)
                if attempt == attempts:
                    log.warning("model call failed after %d attempts: %s", attempts, e)
                    self.failed = e
                    return
                log.warning("stream broke (attempt %d/%d), restarting: %s", attempt, attempts, e)
                yield stream.data("notice", {"text": STREAM_RETRY_NOTICE,
                                             "reason": "stream_retry", "attempt": attempt})
                await asyncio.sleep(_RETRY_BACKOFF * attempt)
                continue
            if started:
                yield stream.text_end(text_id)
            self.text, self.calls, self.usage = "".join(parts).strip(), calls, usage
            return


class TurnRunner:
    def __init__(self, sandbox: Sandbox, stage: str, history: list[dict],
                 user_text: str, spec_md: str | None = None,
                 recent_files: list[str] | None = None,
                 cancelled: Callable[[], bool] = lambda: False,
                 message_id: str | None = None,
                 backend: tools.Backend | None = None,
                 assets_block: str = "",
                 keepalive: Callable[[], Awaitable[None]] | None = None,
                 project_id: str = "",
                 critique: bool | None = None,
                 images=None,
                 payments: str | None = None) -> None:
        self.sandbox = sandbox
        self.backend = backend
        #: "paystack" when the project takes payments; adds the skill.
        self.payments = payments
        #: An ImageMaker when the image model is configured; the model may
        #: make pictures for a project with no uploads.
        self.images = images
        self.assets_block = assets_block
        self.project_id = project_id
        #: Screenshot the page after the answer and let the model fix what
        #: it sees. Defaults to the setting; the eval turns it off for A.
        self.critique = settings.BUILDER_DESIGN_CRITIQUE if critique is None else critique
        #: Awaited after every step. A long turn outlives a sandbox whose
        #: lifetime is only extended between turns; this extends it as
        #: the turn goes.
        self.keepalive = keepalive
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

        if outcome in RETRYABLE and outcome != ERROR:
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
        messages = [{"role": "system",
                     "content": prompt.system_prompt(
                         self.spec_md, block, backend=self.backend is not None,
                         assets_block=self.assets_block,
                         skill_block=skills.ui_block(self.spec_md, self.user_text,
                                                    payments=self.payments))}]
        messages += self.history
        messages.append({"role": "user", "content": self.user_text})

        strikes = 0
        # The turn's stage, not the attempt's: a fallback attempt of a first
        # build is still a first build (budget, review, critique).
        first_build = self.stage == routing.BUILD
        budget = settings.BUILDER_BUILD_MAX_STEPS if first_build else settings.BUILDER_MAX_STEPS
        completion_left = settings.BUILDER_COMPLETION_ROUNDS if first_build else 0
        critique_left = settings.BUILDER_CRITIQUE_ROUNDS if self.critique else 0
        # A small edit does not need a screenshot pass; a first build, a
        # request about looks, or a turn that touched several files does.
        critique_always = first_build or _about_looks(self.user_text)
        nudges_left = 2
        review_deadline = None
        step = 0
        while True:
            step += 1
            if step > budget:
                if (review_deadline is not None and step > review_deadline
                        and critique_left > 0 and self.result.touched):
                    # The review spent its steps mid-work. Close it with a
                    # look at the page: the critique keeps its own budget.
                    review_deadline = None
                    critique_left -= 1
                    shots = await screenshots.capture(
                        self.sandbox, self.project_id or "project",
                        f"{self.message_id}-r{self.result.critique_rounds + 1}")
                    if shots:
                        self.result.critique_rounds += 1
                        self.result.screenshots += [s.key for s in shots if s.key]
                        yield stream.data("critique", {
                            "round": self.result.critique_rounds,
                            "broken": bool(screenshots.last_report and screenshots.last_report.broken),
                            "screenshots": [{"name": s.name, "width": s.width, "url": s.url}
                                            for s in shots]})
                        messages.append(screenshots.critique_message(shots, screenshots.last_report))
                        budget = step + settings.BUILDER_CRITIQUE_STEPS
                        self.result.reason = ANSWERED
                        if self.keepalive is not None:
                            await self.keepalive()
                        continue
                break
            if self.cancelled():
                yield stream.abort("cancelled by the user")
                self.result.reason = CANCELLED
                return
            self.result.steps += 1
            yield stream.start_step()

            call_step = ModelStep(messages, tools.schemas_for(self.backend, self.images), endpoint)
            async for part in call_step.run():
                yield part
            if call_step.failed is not None:
                yield stream.error(call_step.failed.public)
                self.result.reason = ERROR
                return
            self.result.calls.append(ModelCall(endpoint.model, stage, call_step.usage))
            text, calls = call_step.text, call_step.calls

            if not calls:
                messages.append({"role": "assistant", "content": text})
                yield stream.finish_step()
                if nudges_left > 0 and _announces_more_work(text):
                    # "Let me build the pages." with no tool call is not the
                    # end of the turn; tell the model to go on.
                    nudges_left -= 1
                    messages.append({"role": "user", "content": CONTINUE_NUDGE})
                    continue
                self.result.reason = ANSWERED
                if completion_left > 0 and self.result.touched:
                    # Content before looks: is the whole spec there?
                    completion_left -= 1
                    self.result.completion_rounds += 1
                    yield stream.data("status", {"text": "Checking the app against the spec"})
                    yield stream.data("review", {"kind": "completeness",
                                                 "round": self.result.completion_rounds})
                    messages.append({"role": "user", "content": COMPLETION_BRIEF})
                    budget = step + settings.BUILDER_COMPLETION_STEPS
                    review_deadline = budget
                    if self.keepalive is not None:
                        await self.keepalive()
                    continue
                if critique_left > 0 and self.result.touched and (
                        critique_always
                        or len(self.result.touched) >= settings.BUILDER_CRITIQUE_MIN_FILES):
                    # The page is whole: look at it, then keep going with a
                    # few extra steps for the fixes.
                    critique_left -= 1
                    yield stream.data("status", {"text": "Looking at the page on desktop and phone"})
                    shots = await screenshots.capture(
                        self.sandbox, self.project_id or "project",
                        f"{self.message_id}-r{self.result.critique_rounds + 1}")
                    if shots:
                        self.result.critique_rounds += 1
                        self.result.screenshots += [s.key for s in shots if s.key]
                        yield stream.data("critique", {
                            "round": self.result.critique_rounds,
                            "broken": bool(screenshots.last_report and screenshots.last_report.broken),
                            "screenshots": [{"name": s.name, "width": s.width, "url": s.url}
                                            for s in shots]})
                        messages.append(screenshots.critique_message(shots, screenshots.last_report))
                        budget = step + settings.BUILDER_CRITIQUE_STEPS
                        if self.keepalive is not None:
                            await self.keepalive()
                        continue
                return

            messages.append({
                "role": "assistant", "content": text or None,
                "tool_calls": [{"id": c["id"], "type": "function",
                                "function": {"name": c["name"],
                                             "arguments": json.dumps(c["arguments"])}}
                               for c in calls]})

            # Writes in this step are typechecked once, together, after the
            # last of them; their outputs are held back until the report
            # exists so the model reads it next to the file it belongs to.
            held: list[tuple[dict, tools.Outcome]] = []
            results: dict[str, str] = {}
            wrote_kind = None
            for call in calls:
                if self.cancelled():
                    yield stream.abort("cancelled by the user")
                    self.result.reason = CANCELLED
                    return
                yield stream.tool_input(call["id"], call["name"], call["arguments"])
                status = _status_for(call)
                if status and status != wrote_kind:
                    wrote_kind = status
                    yield stream.data("status", {"text": status})
                if call.get("error"):
                    content = f"error: {call['error']}. Call the tool again with valid JSON."
                    yield stream.tool_error(call["id"], content)
                    results[call["id"]] = content
                    continue
                outcome = await tools.execute(call["name"], call["arguments"],
                                              self.sandbox, self.backend, self.images,
                                              typecheck_now=False)
                if outcome.touched and outcome.touched not in self.result.touched:
                    self.result.touched.append(outcome.touched)
                if outcome.touched:
                    held.append((call, outcome))
                else:
                    yield stream.tool_output(call["id"], outcome.text)
                    results[call["id"]] = outcome.text
            if held:
                ok, report = await tools.typecheck(self.sandbox)
                if ok:
                    strikes = 0
                else:
                    strikes += 1
                    self.result.typecheck_failures += 1
                for i, (call, outcome) in enumerate(held):
                    text = outcome.text
                    if i == len(held) - 1:
                        text = tools.truncate(f"{text}\n{report}")
                    yield stream.tool_output(call["id"], text)
                    results[call["id"]] = text
            for call in calls:
                messages.append({"role": "tool", "tool_call_id": call["id"],
                                 "name": call["name"], "content": results.get(call["id"], "")})
            yield stream.finish_step()
            if self.keepalive is not None:
                try:
                    await self.keepalive()
                except Exception as e:                       # never fails a turn
                    log.warning("keepalive failed: %s", e)

            if strikes >= settings.BUILDER_TYPECHECK_STRIKES:
                self.result.reason = TYPECHECK_STRIKES
                return

        # Out of steps. During a review or critique the page was already
        # answered for, so the turn still counts as done.
        if (self.result.critique_rounds or self.result.completion_rounds) \
                and self.result.reason == ANSWERED:
            return
        self.result.reason = STEP_LIMIT


#: Plain-English phase lines for a client that wants one sentence.
_TOOL_STATUS = {
    "read_file": "Reading the project", "list_files": "Reading the project",
    "write_file": "Writing the app", "edit_file": "Making the change",
    "run_command": "Installing and running", "get_dev_server_logs": "Checking the dev server",
    "generate_image": "Making pictures", "apply_migration": "Updating the database",
    "deploy_edge_function": "Deploying server code", "set_secret": "Storing a secret",
}

_LOOKS = re.compile(r"\b(design|look|looks|colou?r|colours|layout|spacing|font|style|styling|"
                    r"theme|ui|mobile|responsive|hero|padding|margin|align|prettier|beautiful|"
                    r"premium|logo|image|photo)\b", re.IGNORECASE)


def _status_for(call: dict) -> str | None:
    return _TOOL_STATUS.get(call.get("name", ""))


def _about_looks(text: str) -> bool:
    return bool(_LOOKS.search(text or ""))


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
