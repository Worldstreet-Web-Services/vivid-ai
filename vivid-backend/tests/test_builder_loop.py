"""The turn loop with the model scripted: answers end the turn, tool calls
are executed and fed back, the step cap and repeated typecheck failures hand
the turn to the fallback model once, and cancel stops it."""
import pytest

from app.builder import loop, routing, stream
from app.builder.loop import TurnRunner
from app.core.config import settings
from app.services.models_gateway import code_llm
from tests.builder_fakes import FakeSandbox


def call(name: str, args: dict, cid: str = "c1") -> dict:
    return {"id": cid, "name": name, "arguments": args, "error": None}


class ScriptedModel:
    """Each entry is (text, calls) for one model call; records what it saw."""

    def __init__(self, script: list[tuple[str, list[dict]]]) -> None:
        self.script = list(script)
        self.requests: list[dict] = []

    async def stream_chat(self, messages, tools, max_tokens=None, endpoint=None,
                          temperature=None):
        # A copy: the loop keeps appending to the same list.
        self.requests.append({"messages": [dict(m) for m in messages], "model": endpoint.model})
        if not self.script:
            text, calls = "Done.", []
        else:
            text, calls = self.script.pop(0)
        for ch in text:
            yield {"type": "token", "text": ch}
        if calls:
            yield {"type": "tool_calls", "calls": calls}
        yield {"type": "done", "finish_reason": "stop",
               "usage": {"prompt_tokens": 100, "completion_tokens": 10}}


@pytest.fixture(autouse=True)
def models(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(settings, "BUILD_MODEL", "vendor/primary")
    monkeypatch.setattr(settings, "EDIT_MODEL", "vendor/primary")
    monkeypatch.setattr(settings, "FALLBACK_MODEL", "vendor/fallback")
    monkeypatch.setattr(settings, "BUILDER_MAX_STEPS", 3)
    monkeypatch.setattr(settings, "BUILDER_TYPECHECK_STRIKES", 2)


def install(monkeypatch, script) -> ScriptedModel:
    model = ScriptedModel(script)
    monkeypatch.setattr(code_llm, "stream_chat", model.stream_chat)
    return model


async def collect(runner: TurnRunner) -> tuple[list[dict], stream.PartsCollector]:
    parts, c = [], stream.PartsCollector()
    async for part in runner.run():
        parts.append(part)
        c.add(part)
    return parts, c


async def test_tool_call_then_answer(monkeypatch):
    model = install(monkeypatch, [
        ("Adding it.", [call("write_file", {"path": "src/A.tsx", "content": "export {}"})]),
        ("You now have a page.", []),
    ])
    sb = FakeSandbox({"src/App.tsx": "x", "src/main.tsx": "y", "package.json": "{}"})
    runner = TurnRunner(sb, routing.BUILD, [], "add a page", spec_md="# Spec\nA thing")
    parts, c = await collect(runner)

    assert parts[0]["type"] == "start" and parts[-1]["type"] == "finish"
    assert runner.result.reason == loop.ANSWERED
    assert runner.result.steps == 2 and runner.result.model == "vendor/primary"
    assert runner.result.touched == ["src/A.tsx"] and sb.files["src/A.tsx"] == "export {}"
    assert c.text() == "Adding it.\nYou now have a page."
    tool_parts = [p for p in c.parts if p["type"] == "tool-write_file"]
    assert tool_parts[0]["state"] == "output-available"
    assert "Typecheck: clean" in tool_parts[0]["output"]

    # The second request carried the tool result back to the model, and the
    # system prompt carried the spec and the file tree.
    second = model.requests[1]["messages"]
    assert second[0]["role"] == "system" and "# Spec" in second[0]["content"]
    assert "src/App.tsx" in second[0]["content"]
    assert second[-1]["role"] == "tool" and "Typecheck: clean" in second[-1]["content"]
    assert runner.result.tokens_in == 200 and runner.result.tokens_out == 20


async def test_step_cap_retries_once_on_fallback(monkeypatch):
    forever = [("", [call("list_files", {}, f"c{i}")]) for i in range(10)]
    model = install(monkeypatch, forever)
    sb = FakeSandbox({"src/App.tsx": "x"})
    runner = TurnRunner(sb, routing.EDIT, [], "loop")
    parts, c = await collect(runner)

    models_used = [r["model"] for r in model.requests]
    assert models_used[:3] == ["vendor/primary"] * 3
    assert models_used[3:] == ["vendor/fallback"] * 3
    assert runner.result.retried and runner.result.reason == loop.STEP_LIMIT
    assert runner.result.steps == 6
    notices = [p for p in c.parts if p["type"] == "data-notice"]
    assert notices[0]["data"] == {"text": loop.RETRY_NOTICE, "reason": loop.STEP_LIMIT}
    assert "ran out of steps" in c.text()


async def test_typecheck_strikes_retry_on_fallback(monkeypatch):
    broken = [("", [call("write_file", {"path": "src/A.tsx", "content": "bad"}, f"c{i}")])
              for i in range(3)]
    model = install(monkeypatch, broken + [("Fixed.", [])])
    sb = FakeSandbox({"src/App.tsx": "x"})
    sb.tsc_output = "src/A.tsx(1,1): error TS1005: ';' expected."
    runner = TurnRunner(sb, routing.EDIT, [], "break it")

    async def clean_after_fallback():
        # The fallback's second write passes, then it answers.
        async for part in runner.run():
            if part.get("type") == "data-notice":
                sb.tsc_output = ""
            yield part

    parts = [p async for p in clean_after_fallback()]
    # Two strikes on the primary, then the fallback writes once (clean now)
    # and answers.
    assert [r["model"] for r in model.requests] == (
        ["vendor/primary"] * 2 + ["vendor/fallback"] * 2)
    assert runner.result.reason == loop.ANSWERED and runner.result.retried
    assert runner.result.typecheck_failures == 2
    assert parts[-1]["type"] == "finish"


async def test_cancel_stops_between_steps(monkeypatch):
    install(monkeypatch, [("", [call("list_files", {})]), ("", [call("list_files", {})])])
    flag = {"cancel": False}
    sb = FakeSandbox({"src/App.tsx": "x"})
    runner = TurnRunner(sb, routing.EDIT, [], "go", cancelled=lambda: flag["cancel"])
    parts = []
    async for part in runner.run():
        parts.append(part)
        if part["type"] == "tool-output-available":
            flag["cancel"] = True
    assert runner.result.reason == loop.CANCELLED
    assert any(p["type"] == "abort" for p in parts)
    assert parts[-1]["type"] == "finish"


async def test_model_failure_is_an_error_part(monkeypatch):
    async def broken(*a, **k):
        raise code_llm.CodeLLMUnavailable("upstream 502")
        yield  # pragma: no cover
    monkeypatch.setattr(code_llm, "stream_chat", broken)
    runner = TurnRunner(FakeSandbox({"src/App.tsx": "x"}), routing.BUILD, [], "hi")
    parts, _ = await collect(runner)
    errors = [p for p in parts if p["type"] == "error"]
    assert errors and "unavailable" in errors[0]["errorText"]
    assert runner.result.reason == loop.ERROR and not runner.result.retried


async def test_bad_tool_arguments_go_back_to_the_model(monkeypatch):
    model = install(monkeypatch, [
        ("", [{"id": "c1", "name": "read_file", "arguments": {},
               "error": "arguments were not valid JSON"}]),
        ("ok", []),
    ])
    runner = TurnRunner(FakeSandbox({"src/App.tsx": "x"}), routing.EDIT, [], "hi")
    parts, c = await collect(runner)
    assert [p for p in c.parts if p["type"] == "tool-read_file"][0]["state"] == "output-error"
    assert "valid JSON" in model.requests[1]["messages"][-1]["content"]


def test_stage_routing(monkeypatch):
    assert routing.stage_for(0) == routing.BUILD
    assert routing.stage_for(3) == routing.EDIT
    ep = routing.endpoint_for(routing.FALLBACK)
    assert ep.model == "vendor/fallback" and ep.provider == "openrouter" and ep.configured
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    assert not routing.endpoint_for(routing.BUILD).configured


def test_turn_registry():
    reg = loop.TurnRegistry()
    ev = reg.start("p1")
    assert ev is not None and reg.start("p1") is None and reg.running("p1")
    assert reg.cancel("p1") and ev.is_set()
    reg.finish("p1")
    assert not reg.running("p1") and not reg.cancel("p1")
