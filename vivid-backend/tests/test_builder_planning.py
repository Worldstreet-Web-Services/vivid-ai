"""Plan mode: the questions tool ends the turn and is validated, the spec
tool stores a spec with the fixed headings, stored turns become history the
model can read, and the route keeps plan mode away from the sandbox."""
import pytest

from app.builder import planning, routing, stream
from app.builder.planning import PlanRunner
from app.core.config import settings
from app.services.models_gateway import code_llm

QUESTIONS = [
    {"id": "audience", "question": "Who is it for?",
     "options": ["Customers", "Staff", "Both"]},
    {"id": "auth", "question": "Do people sign in?", "options": ["Yes", "No"],
     "allow_free_text": False},
]
SPEC = """# Spec
## Goal
A booking app for a salon.
## Users
Customers and the owner.
## Pages
Home, Book, My bookings.
## Data model
Booking: id, name, service, time.
## Integrations
Supabase auth.
## Out of scope
Payments.
"""


def call(name, args, cid="c1"):
    return {"id": cid, "name": name, "arguments": args, "error": None}


class Scripted:
    def __init__(self, script):
        self.script = list(script)
        self.requests = []

    async def stream_chat(self, messages, tools, max_tokens=None, endpoint=None, temperature=None):
        self.requests.append({"messages": [dict(m) for m in messages],
                              "tools": [t["function"]["name"] for t in tools],
                              "model": endpoint.model})
        text, calls = self.script.pop(0) if self.script else ("ok", [])
        if text:
            yield {"type": "token", "text": text}
        if calls:
            yield {"type": "tool_calls", "calls": calls}
        yield {"type": "done", "finish_reason": "stop",
               "usage": {"prompt_tokens": 3, "completion_tokens": 1}}


@pytest.fixture(autouse=True)
def models(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "k")
    monkeypatch.setattr(settings, "PLAN_MODEL", "vendor/planner")
    monkeypatch.setattr(settings, "CODE_STREAM_RETRIES", 1)


def install(monkeypatch, script):
    m = Scripted(script)
    monkeypatch.setattr(code_llm, "stream_chat", m.stream_chat)
    return m


async def collect(runner):
    parts, c = [], stream.PartsCollector()
    async for p in runner.run():
        parts.append(p)
        c.add(p)
    return parts, c


async def test_ask_user_ends_the_turn(monkeypatch):
    m = install(monkeypatch, [("A few questions first.", [call("ask_user", {"questions": QUESTIONS})]),
                              ("should not run", [])])
    runner = PlanRunner([], "a booking app for my salon", brief=False)
    parts, c = await collect(runner)
    assert runner.result.reason == planning.ASKED and runner.result.steps == 1
    assert runner.result.model == "vendor/planner"
    assert m.requests[0]["tools"] == ["ask_user", "write_spec"]
    assert m.requests[0]["messages"][0]["content"].startswith("You are Vivid, planning")
    tool = [p for p in c.parts if p["type"] == "tool-ask_user"][0]
    assert tool["state"] == "output-available"
    assert tool["input"]["questions"][1]["allow_free_text"] is False
    assert runner.result.questions[0]["allow_free_text"] is True
    assert parts[-1]["type"] == "finish" and len(m.requests) == 1


async def test_bad_questions_are_sent_back_then_spec_written(monkeypatch):
    m = install(monkeypatch, [
        ("", [call("ask_user", {"questions": [{"question": "only one?", "options": ["a", "b"]}]})]),
        ("", [call("write_spec", {"markdown": "too short"}, "c2")]),
        ("", [call("write_spec", {"markdown": SPEC}, "c3")]),
        ("The spec covers booking and sign-in. Edit it or start the build.", []),
    ])
    runner = PlanRunner([{"role": "user", "content": "salon app"},
                         {"role": "assistant", "content": "I asked: ..."}], "Customers. Yes.",
                        brief=False)
    parts, c = await collect(runner)
    assert runner.result.reason == planning.SPEC_WRITTEN
    assert runner.result.spec_md == SPEC.strip()
    assert runner.result.fullstack is False                     # not asked for: a site
    errors = [p for p in c.parts if p["type"].startswith("tool-") and p["state"] == "output-error"]
    assert "between 2 and 6" in errors[0]["errorText"]
    assert "too short" in errors[1]["errorText"]
    assert [p["type"] for p in parts if p["type"].startswith("data-")] == ["data-spec", "data-usage"]
    assert c.text().startswith("The spec covers")
    assert runner.result.steps == 4 and len(runner.result.calls) == 4


async def test_images_become_image_parts(monkeypatch):
    m = install(monkeypatch, [("noted", [])])
    runner = PlanRunner([], "like this", images=["data:image/png;base64,AAAA"], brief=False)
    await collect(runner)
    user = m.requests[0]["messages"][-1]["content"]
    assert user[0] == {"type": "text", "text": "like this"}
    assert user[1]["type"] == "image_url"


async def test_step_limit_and_model_failure(monkeypatch):
    install(monkeypatch, [("", [call("write_spec", {"markdown": "x"}, f"c{i}")])
                          for i in range(10)])
    runner = PlanRunner([], "go", brief=False)
    await collect(runner)
    assert runner.result.reason == planning.STEP_LIMIT and runner.result.steps == planning.MAX_STEPS

    async def broken(*a, **k):
        raise code_llm.CodeLLMUnavailable("down")
        yield
    monkeypatch.setattr(code_llm, "stream_chat", broken)
    runner = PlanRunner([], "go", brief=False)
    parts, _ = await collect(runner)
    assert runner.result.reason == planning.ERROR
    assert any(p["type"] == "error" for p in parts)


def test_history_from_parts():
    class M:
        def __init__(self, role, parts):
            self.role, self.parts = role, parts
    msgs = [
        M("user", [{"type": "text", "text": "salon app"}]),
        M("assistant", [{"type": "text", "text": "Questions:"},
                        {"type": "tool-ask_user", "input": {"questions": QUESTIONS}}]),
        M("user", [{"type": "text", "text": "Both. Yes."}]),
        M("assistant", [{"type": "tool-write_spec", "input": {"markdown": "# Spec ..."}}]),
    ]
    h = planning.history_from_parts(msgs)
    assert [m["role"] for m in h] == ["user", "assistant", "user", "assistant"]
    assert "Who is it for? (options: Customers, Staff, Both)" in h[1]["content"]
    assert h[3]["content"] == "I wrote this spec:\n# Spec ..."


def test_validators():
    qs, err = planning.validate_questions(QUESTIONS)
    assert err is None and qs[0]["id"] == "audience"
    assert planning.validate_questions([QUESTIONS[0]])[1].startswith("give between")
    assert "needs 2 to 4 options" in planning.validate_questions(
        [QUESTIONS[0], {"question": "x", "options": ["a"]}])[1]
    assert "missing these headings: Integrations" in planning.validate_spec(
        SPEC.replace("## Integrations\nSupabase auth.\n", ""))[1]
    assert routing.endpoint_for(routing.PLAN).model == "vendor/planner"


async def test_first_message_goes_through_the_prompt_builder(monkeypatch):
    """A one-liner is expanded into a brief first (no tools), streamed as
    text and a data-brief part; the planner then asks from the brief."""
    from app.builder import meta
    m = install(monkeypatch, [
        ("## What it is\nA sneaker shop in Lagos...\n## Assumptions to confirm\n- Sizes UK 6-12?", []),
        ("Two questions.", [call("ask_user", {"questions": QUESTIONS})]),
    ])
    runner = PlanRunner([], "an ecommerce site for my sneakers")
    parts, c = await collect(runner)
    assert m.requests[0]["tools"] == [] and m.requests[0]["messages"][0]["content"] == meta.META_PROMPT
    assert m.requests[1]["tools"] == ["ask_user", "write_spec"]
    planner_msgs = m.requests[1]["messages"]
    assert planner_msgs[-2]["role"] == "assistant" and "How I understand the idea" in planner_msgs[-2]["content"] or "understand the idea" in planner_msgs[-2]["content"]
    assert planner_msgs[-1]["role"] == "user" and "ask_user" in planner_msgs[-1]["content"]
    assert runner.result.brief_md.startswith("## What it is")
    kinds = [p["type"] for p in parts if p["type"].startswith("data-")]
    assert kinds[0] == "data-brief"
    assert runner.result.reason == planning.ASKED
    assert c.text().startswith("## What it is")
    # A second turn (answers) does not expand again.
    m2 = install(monkeypatch, [("", [call("write_spec", {"markdown": SPEC})]), ("done", [])])
    runner = PlanRunner([{"role": "user", "content": "x"}, {"role": "assistant", "content": "y"}], "Both. Yes.")
    await collect(runner)
    assert m2.requests[0]["tools"] == ["ask_user", "write_spec"]


def test_history_keeps_the_brief():
    class M:
        def __init__(self, role, parts):
            self.role, self.parts = role, parts
    h = planning.history_from_parts([M("assistant", [{"type": "text", "text": "## What it is"},
                                                      {"type": "data-brief", "data": {"markdown": "## What it is\nshop"}}])])
    assert "Here is how I understand the idea" in h[0]["content"]
