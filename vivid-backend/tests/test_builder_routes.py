"""The /v1/builder routes against an in-memory database, a fake sandbox
manager and a scripted model: ownership, the streamed turn and what it
stores, one turn at a time, the rate limit, cancel, preview and files."""
import json

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pgvector.sqlalchemy import Vector
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.api import deps
from app.api.deps import Principal, get_db, get_principal
from app.api.routes import builder as builder_routes
from app.api.routes.builder import router
from app.builder import loop as loop_mod
from app.builder.sandbox.base import SandboxError
from app.core import errors
from app.core.config import settings
from app.db.models import Base, BuilderMessage, BuilderProject, User
from app.services.models_gateway import code_llm
from tests.builder_fakes import FakeSandbox
from tests.conftest import FakeRedis


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(Vector, "sqlite")
def _vector_on_sqlite(type_, compiler, **kw):
    return "BLOB"


class FakeManager:
    def __init__(self) -> None:
        self.sandbox = FakeSandbox({"src/App.tsx": "x", "src/main.tsx": "y",
                                    "package.json": "{}"})
        self.fail = False
        self.killed: list[str] = []
        self.touched: list[str] = []

    async def get_or_create(self, project_id, redis, restore=None):
        if self.fail:
            raise SandboxError("no sandbox for you")
        return self.sandbox

    async def touch(self, project_id):
        self.touched.append(project_id)

    async def kill(self, project_id, redis):
        self.killed.append(project_id)


@pytest_asyncio.fixture
async def maker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as db:
        db.add_all([User(id="u1", email="a@vivid", password_hash="x"),
                    User(id="u2", email="b@vivid", password_hash="x")])
        await db.commit()
    yield maker
    await engine.dispose()


@pytest.fixture
def fake_manager(monkeypatch) -> FakeManager:
    fm = FakeManager()
    monkeypatch.setattr(builder_routes, "manager", fm)
    return fm


@pytest.fixture
def client(maker, monkeypatch, fake_manager):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test")
    monkeypatch.setattr(settings, "BUILDER_MAX_STEPS", 5)
    # The route persists the assistant message on its own session.
    monkeypatch.setattr(builder_routes, "async_session", maker)
    # A fresh registry per test so a failed test cannot leave a project busy.
    monkeypatch.setattr(builder_routes, "turns", loop_mod.TurnRegistry())

    app = FastAPI()
    errors.install(app)
    app.include_router(router, prefix="/v1")
    app.state.redis = FakeRedis()
    app.state.redis.incr = _incr(app.state.redis)
    current = {"id": "u1"}

    async def db():
        async with maker() as session:
            yield session

    async def principal(db=None):
        async with maker() as session:
            user = await session.get(User, current["id"])
        return Principal(user=user, client_id="vivid_web")

    app.dependency_overrides[get_db] = db
    app.dependency_overrides[get_principal] = principal
    tc = TestClient(app, raise_server_exceptions=False)
    tc.as_user = lambda uid: current.__setitem__("id", uid)
    return tc


def _incr(redis):
    async def incr(key):
        redis.strings[key] = str(int(redis.strings.get(key, "0")) + 1)
        return int(redis.strings[key])
    return incr


def script(monkeypatch, steps):
    async def stream_chat(messages, tools, max_tokens=None, endpoint=None, temperature=None):
        text, calls = steps.pop(0) if steps else ("Done.", [])
        if text:
            yield {"type": "token", "text": text}
        if calls:
            yield {"type": "tool_calls", "calls": calls}
        yield {"type": "done", "finish_reason": "stop",
               "usage": {"prompt_tokens": 5, "completion_tokens": 2}}
    monkeypatch.setattr(code_llm, "stream_chat", stream_chat)


def sse_parts(body: str) -> list:
    out = []
    for line in body.split("\n"):
        if line.startswith("data: "):
            payload = line[6:]
            out.append("[DONE]" if payload == "[DONE]" else json.loads(payload))
    return out


# --------------------------------------------------------------- tests
def test_projects_are_owned(client):
    r = client.post("/v1/builder/projects", json={"name": "Shop"})
    assert r.status_code == 201
    pid = r.json()["id"]
    assert r.json()["backend_mode"] == "none"
    assert [p["id"] for p in client.get("/v1/builder/projects").json()] == [pid]

    client.as_user("u2")
    assert client.get(f"/v1/builder/projects/{pid}").status_code == 404
    assert client.get("/v1/builder/projects").json() == []
    assert client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "hi"}).status_code == 404

    client.as_user("u1")
    r = client.patch(f"/v1/builder/projects/{pid}", json={"spec_md": "# Spec"})
    assert r.json()["spec_md"] == "# Spec"


def test_chat_streams_and_stores_the_turn(client, maker, monkeypatch, fake_manager):
    script(monkeypatch, [
        ("Adding it.", [{"id": "c1", "name": "write_file", "error": None,
                         "arguments": {"path": "src/Page.tsx", "content": "export {}"}}]),
        ("There is a page now.", []),
    ])
    pid = client.post("/v1/builder/projects", json={}).json()["id"]
    with client.stream("POST", f"/v1/builder/projects/{pid}/chat",
                       json={"text": "add a page"}) as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        assert r.headers["x-vercel-ai-ui-message-stream"] == "v1"
        parts = sse_parts("".join(r.iter_text()))

    assert parts[0]["type"] == "start" and parts[-1] == "[DONE]" and parts[-2]["type"] == "finish"
    kinds = [p["type"] for p in parts if isinstance(p, dict)]
    assert "tool-input-available" in kinds and "tool-output-available" in kinds
    assert fake_manager.sandbox.files["src/Page.tsx"] == "export {}"
    assert fake_manager.touched == [pid]

    msgs = client.get(f"/v1/builder/projects/{pid}/messages").json()
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[0]["parts"] == [{"type": "text", "text": "add a page"}]
    texts = [p["text"] for p in msgs[1]["parts"] if p["type"] == "text"]
    assert texts == ["Adding it.", "There is a page now."]
    tool = [p for p in msgs[1]["parts"] if p["type"] == "tool-write_file"][0]
    assert tool["state"] == "output-available"
    assert msgs[1]["model"] == settings.BUILD_MODEL

    # The touched file is remembered for the next turn's context block.
    proj = client.get(f"/v1/builder/projects/{pid}").json()
    assert proj["id"] == pid
    import asyncio

    async def recent():
        async with maker() as db:
            return (await db.get(BuilderProject, pid)).recent_files
    assert asyncio.run(recent()) == [["src/Page.tsx"]]


def test_sandbox_failure_is_a_clean_stream(client, monkeypatch, fake_manager):
    fake_manager.fail = True
    pid = client.post("/v1/builder/projects", json={}).json()["id"]
    r = client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "hi"})
    parts = sse_parts(r.text)
    assert parts[0]["type"] == "error" and "workspace" in parts[0]["errorText"]
    assert parts[-1] == "[DONE]"
    # The user message is kept; nothing else was stored.
    assert [m["role"] for m in client.get(f"/v1/builder/projects/{pid}/messages").json()] == ["user"]
    assert client.get(f"/v1/builder/projects/{pid}/preview").status_code == 503


def test_one_turn_at_a_time_and_cancel(client, monkeypatch):
    pid = client.post("/v1/builder/projects", json={}).json()["id"]
    assert client.post(f"/v1/builder/projects/{pid}/cancel").json() == {"cancelled": False}
    assert builder_routes.turns.start(pid) is not None      # a turn in flight
    r = client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "hi"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "busy"
    assert client.post(f"/v1/builder/projects/{pid}/cancel").json() == {"cancelled": True}


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "BUILDER_RATE_LIMIT_PER_MINUTE", 1)
    script(monkeypatch, [("ok", [])])
    pid = client.post("/v1/builder/projects", json={}).json()["id"]
    assert client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "a"}).status_code == 200
    r = client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "b"})
    assert r.status_code == 429 and r.json()["error"]["code"] == "rate_limited"


def test_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    pid = client.post("/v1/builder/projects", json={}).json()["id"]
    r = client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "a"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "not_configured"


def test_preview_and_files(client, fake_manager):
    pid = client.post("/v1/builder/projects", json={}).json()["id"]
    r = client.get(f"/v1/builder/projects/{pid}/preview")
    assert r.json() == {"url": "http://fake:5173", "sandbox_id": "fake_1", "driver": "fake"}
    assert client.get(f"/v1/builder/projects/{pid}/files").json() == {
        "files": ["package.json", "src/App.tsx", "src/main.tsx"]}
    assert client.get(f"/v1/builder/projects/{pid}/files/src/App.tsx").json() == {
        "path": "src/App.tsx", "content": "x"}
    assert client.get(f"/v1/builder/projects/{pid}/files/src/nope.tsx").status_code == 404
    r = client.get(f"/v1/builder/projects/{pid}/files/../etc/passwd")
    assert r.status_code in (400, 404)


def test_delete_kills_the_sandbox(client, fake_manager):
    pid = client.post("/v1/builder/projects", json={}).json()["id"]
    assert client.delete(f"/v1/builder/projects/{pid}").status_code == 204
    assert fake_manager.killed == [pid]
    assert client.get(f"/v1/builder/projects/{pid}").status_code == 404
