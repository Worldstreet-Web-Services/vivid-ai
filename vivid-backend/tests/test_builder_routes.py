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
from sqlalchemy.pool import StaticPool

from app.api import deps
from app.api.deps import Principal, get_db, get_principal
from app.api.routes import builder as builder_routes
from app.api.routes.builder import router
from app.builder import blob
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
        #: True until the first get_or_create, like a sandbox that does not exist yet.
        self.fresh = True
        self.killed: list[str] = []
        self.touched: list[str] = []

    async def get_or_create(self, project_id, redis, restore=None):
        if self.fail:
            raise SandboxError("no sandbox for you")
        if self.fresh and restore is not None:
            # A fresh sandbox: the route's restore callback runs once.
            self.fresh = False
            await restore(self.sandbox)
        return self.sandbox

    def peek(self, project_id):
        return None if self.fresh else self.sandbox

    async def touch(self, project_id):
        self.touched.append(project_id)

    async def kill(self, project_id, redis):
        self.killed.append(project_id)


@pytest_asyncio.fixture
async def maker():
    # One shared connection: an in-memory SQLite database exists per
    # connection, and background jobs open sessions of their own.
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", poolclass=StaticPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as db:
        db.add_all([User(id="u1", email="a@vivid", password_hash="x"),
                    User(id="u2", email="b@vivid", password_hash="x")])
        await db.commit()
    yield maker
    await engine.dispose()


@pytest.fixture(autouse=True)
def fake_blob(monkeypatch) -> dict:
    store: dict[str, bytes] = {}

    async def put(key, data, content_type="application/gzip"):
        store[key] = data

    async def get(key):
        return store[key]

    async def delete_prefix(prefix):
        gone = [k for k in store if k.startswith(prefix)]
        for k in gone:
            del store[k]
        return len(gone)
    monkeypatch.setattr(blob, "put", put)
    monkeypatch.setattr(blob, "get", get)
    monkeypatch.setattr(blob, "delete_prefix", delete_prefix)
    return store


@pytest.fixture
def fake_manager(monkeypatch) -> FakeManager:
    fm = FakeManager()
    monkeypatch.setattr(builder_routes, "manager", fm)
    return fm


@pytest.fixture
def client(maker, monkeypatch, fake_manager):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test")
    monkeypatch.setattr(settings, "BUILDER_MAX_STEPS", 5)
    monkeypatch.setattr(settings, "BUILDER_BUILD_MAX_STEPS", 5)
    monkeypatch.setattr(settings, "BUILDER_COMPLETION_ROUNDS", 0)
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
    # Entered as a context so one event loop serves every request and the
    # background jobs the routes start; otherwise each request gets its own
    # loop and the pooled aiosqlite connection is bound to the first.
    with TestClient(app, raise_server_exceptions=False) as tc:
        tc.as_user = lambda uid: current.__setitem__("id", uid)
        yield tc


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
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    with client.stream("POST", f"/v1/builder/projects/{pid}/chat",
                       json={"text": "add a page"}) as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        assert r.headers["x-vercel-ai-ui-message-stream"] == "v1"
        parts = sse_parts("".join(r.iter_text()))

    assert parts[0]["type"] == "start" and parts[-1] == "[DONE]"
    assert parts[-2]["type"] == "data-snapshot" and parts[-2]["data"]["seq"] == 1
    assert parts[-3]["type"] == "finish"
    kinds = [p["type"] for p in parts if isinstance(p, dict)]
    assert "tool-input-available" in kinds and "tool-output-available" in kinds
    assert fake_manager.sandbox.files["src/Page.tsx"] == "export {}"
    assert pid in fake_manager.touched

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
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    r = client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "hi"})
    parts = sse_parts(r.text)
    assert parts[0]["type"] == "error" and "workspace" in parts[0]["errorText"]
    assert parts[-1] == "[DONE]"
    # The user message is kept; nothing else was stored.
    assert [m["role"] for m in client.get(f"/v1/builder/projects/{pid}/messages").json()] == ["user"]
    assert client.get(f"/v1/builder/projects/{pid}/preview").status_code == 503


def test_one_turn_at_a_time_and_cancel(client, monkeypatch):
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    assert client.post(f"/v1/builder/projects/{pid}/cancel").json() == {"cancelled": False}
    assert builder_routes.turns.start(pid) is not None      # a turn in flight
    r = client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "hi"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "busy"
    assert client.post(f"/v1/builder/projects/{pid}/cancel").json() == {"cancelled": True}


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "BUILDER_RATE_LIMIT_PER_MINUTE", 1)
    script(monkeypatch, [("ok", [])])
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    assert client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "a"}).status_code == 200
    r = client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "b"})
    assert r.status_code == 429 and r.json()["error"]["code"] == "rate_limited"


def test_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    r = client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "a"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "not_configured"


def test_preview_and_files(client, fake_manager):
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
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
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    assert client.delete(f"/v1/builder/projects/{pid}").status_code == 204
    assert fake_manager.killed == [pid]
    assert client.get(f"/v1/builder/projects/{pid}").status_code == 404


def test_snapshots_restore_and_usage(client, monkeypatch, fake_manager, fake_blob):
    script(monkeypatch, [
        ("v1", [{"id": "c1", "name": "write_file", "error": None,
                 "arguments": {"path": "src/App.tsx", "content": "one"}}]),
        ("done 1", []),
        ("v2", [{"id": "c2", "name": "write_file", "error": None,
                 "arguments": {"path": "src/App.tsx", "content": "two"}}]),
        ("done 2", []),
        ("just talk", []),
    ])
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    for text in ("first", "second", "chat only"):
        assert client.post(f"/v1/builder/projects/{pid}/chat", json={"text": text}).status_code == 200

    snaps = client.get(f"/v1/builder/projects/{pid}/snapshots").json()
    assert [s["seq"] for s in snaps] == [1, 2]            # the chat-only turn stored nothing
    assert snaps[1]["summary"] == "v2\ndone 2" and snaps[1]["size_bytes"] > 0
    assert len(fake_blob) == 2
    assert client.get(f"/v1/builder/projects/{pid}").json()["current_snapshot_id"] == snaps[1]["id"]
    assert fake_manager.sandbox.files["src/App.tsx"] == "two"

    r = client.post(f"/v1/builder/projects/{pid}/snapshots/1/restore")
    assert r.status_code == 200 and r.json()["seq"] == 1
    assert fake_manager.sandbox.files["src/App.tsx"] == "one"     # live sandbox restored
    assert fake_manager.sandbox.installs == 0                        # package.json unchanged
    assert client.get(f"/v1/builder/projects/{pid}").json()["current_snapshot_id"] == snaps[0]["id"]
    assert client.post(f"/v1/builder/projects/{pid}/snapshots/9/restore").status_code == 404

    u = client.get(f"/v1/builder/projects/{pid}/usage").json()
    assert u["model_calls"] == 5 and u["tokens"] == 5 * 7
    assert u["storage_bytes"] == sum(s["size_bytes"] for s in snaps)
    assert set(u["by_kind"]) == {"model", "storage"}

    # Deleting the project removes its objects too.
    assert client.delete(f"/v1/builder/projects/{pid}").status_code == 204
    assert fake_blob == {}


def test_fresh_sandbox_restores_current_snapshot(client, monkeypatch, fake_manager, fake_blob):
    script(monkeypatch, [
        ("v1", [{"id": "c1", "name": "write_file", "error": None,
                 "arguments": {"path": "src/App.tsx", "content": "built"}}]),
        ("done", []),
    ])
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "build"})
    # The sandbox dies; a fresh one must come back with the snapshot's files.
    fake_manager.sandbox.files["src/App.tsx"] = "x"
    fake_manager.fresh = True
    assert client.get(f"/v1/builder/projects/{pid}/preview").status_code == 200
    assert fake_manager.sandbox.files["src/App.tsx"] == "built"
    assert fake_manager.sandbox.restored == 1


def test_plan_mode_then_build(client, monkeypatch, fake_manager):
    """A new project plans without a sandbox, keeps the spec, and after
    /build the first turn injects the spec and writes spec.md."""
    from tests.test_builder_planning import QUESTIONS, SPEC

    seen = []

    async def stream_chat(messages, tools, max_tokens=None, endpoint=None, temperature=None):
        names = [t["function"]["name"] for t in tools]
        seen.append((names, endpoint.model, messages[0]["content"]))
        if not names:                                   # the prompt builder's brief
            yield {"type": "token", "text": "## What it is\nA salon booking app."}
        elif "ask_user" in names and len(seen) == 2:
            yield {"type": "tool_calls", "calls": [
                {"id": "c1", "name": "ask_user", "error": None,
                 "arguments": {"questions": QUESTIONS}}]}
        elif "ask_user" in names and len(seen) == 3:
            yield {"type": "tool_calls", "calls": [
                {"id": "c2", "name": "write_spec", "error": None, "arguments": {"markdown": SPEC}}]}
        elif "ask_user" in names:
            yield {"type": "token", "text": "Spec ready; edit it or build."}
        else:
            yield {"type": "token", "text": "Built."}
        yield {"type": "done", "finish_reason": "stop", "usage": {"prompt_tokens": 1, "completion_tokens": 1}}
    monkeypatch.setattr(code_llm, "stream_chat", stream_chat)
    monkeypatch.setattr(settings, "PLAN_MODEL", "vendor/planner")
    monkeypatch.setattr(settings, "BUILD_MODEL", "vendor/builder")

    pid = client.post("/v1/builder/projects", json={"name": "Salon"}).json()["id"]
    assert client.get(f"/v1/builder/projects/{pid}").json()["mode"] == "plan"

    parts = sse_parts(client.post(f"/v1/builder/projects/{pid}/chat",
                                  json={"text": "a booking app for my salon"}).text)
    kinds = [p["type"] for p in parts if isinstance(p, dict)]
    assert "tool-input-available" in kinds and parts[-1] == "[DONE]"
    assert "data-brief" in kinds
    assert fake_manager.fresh                                    # no sandbox was started
    assert seen[0][0] == [] and seen[1][0] == ["ask_user", "write_spec"] and seen[1][1] == "vendor/planner"
    assert client.get(f"/v1/builder/projects/{pid}").json()["brief_md"].startswith("## What it is")

    parts = sse_parts(client.post(f"/v1/builder/projects/{pid}/chat",
                                  json={"text": "Both. Yes.", "images": ["data:image/png;base64,AA"]}).text)
    assert any(isinstance(p, dict) and p["type"] == "data-spec" for p in parts)
    proj = client.get(f"/v1/builder/projects/{pid}").json()
    assert proj["mode"] == "plan" and proj["spec_md"] == SPEC.strip()
    msgs = client.get(f"/v1/builder/projects/{pid}/messages").json()
    assert [m["role"] for m in msgs] == ["user", "assistant", "user", "assistant"]
    assert msgs[2]["parts"][1]["type"] == "file"                # the image rode along
    assert [p["type"] for p in msgs[1]["parts"] if p["type"].startswith("tool-")] == ["tool-ask_user"]

    edited = SPEC.strip() + "\nAlso: dark mode."
    client.patch(f"/v1/builder/projects/{pid}", json={"spec_md": edited})
    assert client.post(f"/v1/builder/projects/{pid}/build").json()["mode"] == "build"

    parts = sse_parts(client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "build it"}).text)
    assert seen[-1][0][0] == "read_file" and seen[-1][1] == "vendor/builder"
    assert "Also: dark mode." in seen[-1][2]                     # spec injected into the prompt
    assert fake_manager.sandbox.files["spec.md"] == edited       # and written to the sandbox
    assert not fake_manager.fresh
    u = client.get(f"/v1/builder/projects/{pid}/usage").json()
    assert u["model_calls"] == 5                                 # brief + three plan calls + one build call


def test_skip_plan_starts_in_build_mode(client, monkeypatch, fake_manager):
    script(monkeypatch, [("Built.", [])])
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    assert client.get(f"/v1/builder/projects/{pid}").json()["mode"] == "build"
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "go"})
    assert not fake_manager.fresh and "spec.md" not in fake_manager.sandbox.files


def test_supabase_link_env_and_tools(client, maker, monkeypatch, fake_manager):
    """Link with a connector: keys come from the Management API, the build
    turn writes .env and offers the backend tools; unlink removes both."""
    import asyncio
    from cryptography.fernet import Fernet
    from app.builder import supabase as sb_mod
    from app.db.models import Connector
    from app.services.connectors import tokens
    from tests.test_builder_supabase import StubAPI

    monkeypatch.setattr(settings, "SECRETS_ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setattr(sb_mod, "Management", StubAPI)
    StubAPI.calls = []

    async def add_connector():
        async with maker() as db:
            db.add(Connector(user_id="u1", provider="supabase", name="supabase (Acme)",
                             token=tokens.store("sbp_tok"), config_json={"mode": "authenticated"}))
            await db.commit()
    asyncio.run(add_connector())

    seen = []

    async def stream_chat(messages, tools, max_tokens=None, endpoint=None, temperature=None):
        seen.append(([t["function"]["name"] for t in tools], messages[0]["content"]))
        yield {"type": "token", "text": "ok"}
        yield {"type": "done", "finish_reason": "stop", "usage": None}
    monkeypatch.setattr(code_llm, "stream_chat", stream_chat)

    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    r = client.post(f"/v1/builder/projects/{pid}/supabase", json={"project_ref": "nopenope"})
    assert r.status_code == 404
    r = client.post(f"/v1/builder/projects/{pid}/supabase", json={"project_ref": "refone"})
    assert r.status_code == 200
    assert r.json()["backend_mode"] == "byo" and r.json()["supabase_project_ref"] == "refone"
    assert ("keys", "refone") in StubAPI.calls

    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "build"})
    assert fake_manager.sandbox.files[".env"] == (
        "VITE_SUPABASE_URL=https://refone.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_x\n")
    assert "apply_migration" in seen[-1][0] and "Backend: Supabase" in seen[-1][1]

    r = client.delete(f"/v1/builder/projects/{pid}/supabase")
    assert r.json()["backend_mode"] == "none" and r.json()["supabase_project_ref"] is None
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "again"})
    assert "apply_migration" not in seen[-1][0]


def test_supabase_manual_link_gives_env_but_no_tools(client, monkeypatch, fake_manager):
    from cryptography.fernet import Fernet
    monkeypatch.setattr(settings, "SECRETS_ENCRYPTION_KEY", Fernet.generate_key().decode())
    seen = []

    async def stream_chat(messages, tools, max_tokens=None, endpoint=None, temperature=None):
        seen.append([t["function"]["name"] for t in tools])
        yield {"type": "token", "text": "ok"}
        yield {"type": "done", "finish_reason": "stop", "usage": None}
    monkeypatch.setattr(code_llm, "stream_chat", stream_chat)

    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    r = client.post(f"/v1/builder/projects/{pid}/supabase", json={"project_ref": "abcdef"})
    assert r.status_code == 400                          # no connector, no keys
    r = client.post(f"/v1/builder/projects/{pid}/supabase",
                    json={"project_ref": "abcdef", "anon_key": "sb_publishable_q"})
    assert r.status_code == 200 and r.json()["backend_mode"] == "byo"
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "build"})
    assert fake_manager.sandbox.files[".env"].startswith("VITE_SUPABASE_URL=https://abcdef.supabase.co\n")
    assert "apply_migration" not in seen[-1]


def test_supabase_oauth_routes(client, maker, monkeypatch):
    """authorize hands back a URL and parks state in redis; the callback
    exchanges the code, verifies, and stores the connector for that user."""
    import asyncio
    from cryptography.fernet import Fernet
    from app.api.routes import connectors as connectors_routes
    from app.api.routes.connectors import router as connectors_router
    from app.builder import supabase as sb_mod
    from app.db.models import Connector
    from app.services.connectors import tokens
    from tests.test_builder_supabase import StubAPI

    monkeypatch.setattr(settings, "SECRETS_ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setattr(sb_mod, "Management", StubAPI)
    client.app.include_router(connectors_router, prefix="/v1")

    r = client.get("/v1/connectors/supabase/authorize")
    assert r.status_code == 503                          # no OAuth app registered

    monkeypatch.setattr(settings, "SUPABASE_OAUTH_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "SUPABASE_OAUTH_CLIENT_SECRET", "sec")
    r = client.get("/v1/connectors/supabase/authorize")
    assert r.status_code == 200 and "oauth/authorize" in r.json()["url"]
    state = [k for k in client.app.state.redis.strings if k.startswith("oauth:supabase:")][0]
    state_value = state.split(":", 2)[2]

    async def exchange_code(code, verifier):
        assert code == "the-code" and verifier
        return {"access_token": "oauth-token", "refresh_token": "rt", "expires_in": 3600}
    monkeypatch.setattr(sb_mod, "exchange_code", exchange_code)

    r = client.get("/v1/connectors/supabase/callback", params={"code": "the-code", "state": "wrong"})
    assert r.status_code == 400
    r = client.get("/v1/connectors/supabase/callback", params={"code": "the-code", "state": state_value})
    assert r.status_code == 200 and "connected" in r.text

    async def row():
        async with maker() as db:
            from sqlalchemy import select
            return (await db.execute(select(Connector).where(Connector.provider == "supabase"))).scalar_one()
    c = asyncio.run(row())
    assert c.user_id == "u1" and tokens.read(c.token) == "oauth-token"
    assert c.config_json["via"] == "oauth" and tokens.read(c.config_json["refresh_token"]) == "rt"
    assert c.config_json["projects"][0]["ref"] == "refone"
    assert client.get("/v1/connectors").json()[0]["projects"][0]["ref"] == "refone"


def test_publish_job_updates_row_and_project(client, monkeypatch, fake_manager):
    """POST publish answers 202 with a pending row; the job builds in the
    sandbox, uploads, and the row and project carry the live URL."""
    import asyncio
    from app.builder import publish as publish_mod
    monkeypatch.setattr(settings, "CF_API_TOKEN", "t")
    monkeypatch.setattr(settings, "CF_ACCOUNT_ID", "acct")
    monkeypatch.setattr(settings, "CF_PAGES_PROJECT", "vivid-apps")
    deployed = []

    class FakePages:
        async def deploy(self, site, alias, message):
            deployed.append((sorted(site.files), alias))
            return {"id": "dep"}
    monkeypatch.setattr(publish_mod, "Pages", FakePages)

    async def instant(url, timeout=90):
        return True
    monkeypatch.setattr(publish_mod, "wait_until_live", instant)

    # The job must not touch the one in-memory SQLite connection while the
    # POST's own session is still open; start it after the response.
    real_create_task = asyncio.create_task

    async def later(coro):
        await asyncio.sleep(0.2)
        return await coro
    monkeypatch.setattr(builder_routes.asyncio, "create_task",
                        lambda coro: real_create_task(later(coro)))
    sb = fake_manager.sandbox
    sb.files["dist/index.html"] = "<html>"
    sb.files["dist/assets/a.js"] = "1"

    pid = client.post("/v1/builder/projects", json={"name": "Todo App", "skip_plan": True}).json()["id"]
    r = client.post(f"/v1/builder/projects/{pid}/publish")
    assert r.status_code == 202 and r.json()["status"] == "pending"
    pub_id = r.json()["id"]

    # The job runs on the app's loop between requests. In-memory SQLite has
    # one connection, so wait for the job to finish before asking again.
    import time
    for _ in range(200):
        task = builder_routes._publishing.get(pid)
        if task is None or task.done():
            break
        time.sleep(0.05)
    row = client.get(f"/v1/builder/projects/{pid}/publishes/{pub_id}").json()
    assert row["status"] == "live", row
    alias = publish_mod.alias_for("Todo App", pid)
    assert row["url"] == f"https://{alias}.vivid-apps.pages.dev"
    assert deployed == [(["assets/a.js", "index.html"], alias)]
    assert client.get(f"/v1/builder/projects/{pid}").json()["published_url"] == row["url"]
    assert [p["id"] for p in client.get(f"/v1/builder/projects/{pid}/publishes").json()] == [pub_id]
    assert any("vite build" in c for c in sb.commands)


def test_publish_refused_when_unconfigured_or_busy(client, monkeypatch):
    monkeypatch.setattr(settings, "CF_API_TOKEN", "")
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    assert client.post(f"/v1/builder/projects/{pid}/publish").status_code == 503
    monkeypatch.setattr(settings, "CF_API_TOKEN", "t")
    monkeypatch.setattr(settings, "CF_ACCOUNT_ID", "acct")
    builder_routes.turns.start(pid)
    r = client.post(f"/v1/builder/projects/{pid}/publish")
    assert r.status_code == 409


def test_assets_upload_list_delete_and_prompting(client, monkeypatch, fake_manager, fake_blob):
    """Upload lands in the store and the live sandbox, is listed with a path
    and URL, is described to the build model and shown to the plan model,
    and delete removes it everywhere."""
    from app.builder import blob as blob_mod
    from tests.test_builder_assets import png
    monkeypatch.setattr(blob_mod, "presigned_url", lambda key, expires_in=3600: f"https://r2/{key}")

    pid = client.post("/v1/builder/projects", json={"name": "Kicks"}).json()["id"]  # plan mode
    fake_manager.fresh = False                                   # a live sandbox exists
    r = client.post(f"/v1/builder/projects/{pid}/assets",
                    files={"file": ("Air Max 90.PNG", png(30, 20), "image/png")})
    assert r.status_code == 201, r.text
    asset = r.json()
    assert asset["name"] == "air-max-90.png" and asset["path"] == "/uploads/air-max-90.png"
    assert asset["url"].startswith("https://r2/") and asset["meta"] == {"width": 30, "height": 20}
    assert fake_manager.sandbox.blobs["public/uploads/air-max-90.png"] == png(30, 20)
    assert any(k.endswith("-air-max-90.png") for k in fake_blob)

    r = client.post(f"/v1/builder/projects/{pid}/assets",
                    files={"file": ("virus.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400 and r.json()["error"]["code"] == "bad_asset"
    assert [a["name"] for a in client.get(f"/v1/builder/projects/{pid}/assets").json()] == ["air-max-90.png"]

    seen = []

    async def stream_chat(messages, tools, max_tokens=None, endpoint=None, temperature=None):
        seen.append([dict(m) for m in messages])       # a copy: the runner appends later
        yield {"type": "token", "text": "ok"}
        yield {"type": "done", "finish_reason": "stop", "usage": None}
    monkeypatch.setattr(code_llm, "stream_chat", stream_chat)

    # Plan turn: the list is in the prompt and the image goes along as a
    # picture, both to the prompt builder and to the planner.
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "a sneaker shop"})
    assert "/uploads/air-max-90.png (image/png" in seen[-1][0]["content"]
    assert "logo, product photos" in seen[-1][0]["content"]
    with_images = [m for m in seen[-1] if isinstance(m.get("content"), list)]
    assert with_images and with_images[0]["content"][1]["type"] == "image_url"
    assert with_images[0]["content"][1]["image_url"]["url"].startswith("https://r2/")

    # Build turn: the list is in the prompt.
    client.post(f"/v1/builder/projects/{pid}/build")
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "build"})
    assert "## Files the user uploaded" in seen[-1][0]["content"]

    # A fresh sandbox (the old one died) gets the upload back on any route,
    # not only on a chat turn: preview here.
    del fake_manager.sandbox.blobs["public/uploads/air-max-90.png"]
    fake_manager.fresh = True
    client.get(f"/v1/builder/projects/{pid}/preview")
    assert fake_manager.sandbox.blobs["public/uploads/air-max-90.png"] == png(30, 20)

    assert client.delete(f"/v1/builder/projects/{pid}/assets/{asset['id']}").status_code == 204
    assert client.get(f"/v1/builder/projects/{pid}/assets").json() == []
    assert not any(k.endswith("-air-max-90.png") for k in fake_blob)
    assert any(c.startswith("rm -f public/uploads/air-max-90.png") for c in fake_manager.sandbox.commands)


def test_manual_snapshot(client, monkeypatch, fake_manager, fake_blob):
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    fake_manager.sandbox.files["src/App.tsx"] = "changed by hand"
    r = client.post(f"/v1/builder/projects/{pid}/snapshots")
    assert r.status_code == 200 and r.json()["seq"] == 1 and r.json()["summary"] == "manual snapshot"
    # Nothing changed since: the latest snapshot comes back, no new row.
    r = client.post(f"/v1/builder/projects/{pid}/snapshots")
    assert r.status_code == 200 and r.json()["seq"] == 1
    assert len(client.get(f"/v1/builder/projects/{pid}/snapshots").json()) == 1


def test_paystack_connector_and_payments(client, maker, monkeypatch, fake_manager):
    """Connect Paystack (keys verified), enable payments on a project: the
    public key lands in .env, the skill rides in the prompt, and with a
    Supabase backend the secret key is pushed to the edge-function secrets."""
    import asyncio
    from cryptography.fernet import Fernet
    from app.api.routes.connectors import router as connectors_router
    from app.builder import supabase as sb_mod
    from app.db.models import Connector
    from app.services.connectors import paystack, tokens
    from tests.test_builder_supabase import StubAPI

    monkeypatch.setattr(settings, "SECRETS_ENCRYPTION_KEY", Fernet.generate_key().decode())
    client.app.include_router(connectors_router, prefix="/v1")

    class Resp:
        def __init__(self, status): self.status_code = status
    class FakeHTTP:
        async def get(self, url, params=None, headers=None, timeout=None):
            assert url.endswith("/transaction") and headers["Authorization"].startswith("Bearer sk_test_")
            return Resp(200)
    monkeypatch.setattr(paystack.http, "client", lambda: FakeHTTP())

    r = client.post("/v1/connectors", json={"provider": "paystack", "token": "sk_test_" + "a" * 30})
    assert r.status_code == 422 and "public key" in r.json()["detail"]
    r = client.post("/v1/connectors", json={"provider": "paystack", "token": "sk_test_" + "a" * 30,
                                            "public_key": "pk_live_" + "b" * 30})
    assert r.status_code == 422 and "both" in r.json()["detail"]
    r = client.post("/v1/connectors", json={"provider": "paystack", "token": "sk_test_" + "a" * 30,
                                            "public_key": "pk_test_" + "b" * 30})
    assert r.status_code == 201 and r.json()["mode"] == "test"

    seen = []
    async def stream_chat(messages, tools, max_tokens=None, endpoint=None, temperature=None):
        seen.append(messages[0]["content"])
        yield {"type": "token", "text": "ok"}
        yield {"type": "done", "finish_reason": "stop", "usage": None}
    monkeypatch.setattr(code_llm, "stream_chat", stream_chat)

    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    r = client.post(f"/v1/builder/projects/{pid}/payments")
    assert r.status_code == 200 and r.json()["payments_provider"] == "paystack"
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "add checkout"})
    assert fake_manager.sandbox.files[".env"] == "VITE_PAYSTACK_PUBLIC_KEY=pk_test_" + "b" * 30 + "\n"
    assert "## Payments skill" in seen[-1] and "kobo" in seen[-1]

    # With a Supabase backend, the secret key goes to the edge-function secrets.
    from app.builder import tools as tools_mod
    monkeypatch.setattr(sb_mod, "Management", StubAPI)
    monkeypatch.setattr(tools_mod, "Management", StubAPI)
    StubAPI.calls = []
    async def add_sb():
        async with maker() as db:
            db.add(Connector(user_id="u1", provider="supabase", name="supabase (Acme)",
                             token=tokens.store("sbp_tok"), config_json={"mode": "authenticated"}))
            await db.commit()
    asyncio.run(add_sb())
    client.post(f"/v1/builder/projects/{pid}/supabase", json={"project_ref": "refone"})
    client.post(f"/v1/builder/projects/{pid}/payments")
    assert ("secrets", "refone", {"PAYSTACK_SECRET_KEY": "sk_test_" + "a" * 30}) in StubAPI.calls

    r = client.delete(f"/v1/builder/projects/{pid}/payments")
    assert r.json()["payments_provider"] == "none"
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "again"})
    assert "## Payments skill" not in seen[-1] and "VITE_PAYSTACK_PUBLIC_KEY" not in fake_manager.sandbox.files[".env"]


def test_undo_and_logs(client, monkeypatch, fake_manager, fake_blob):
    script(monkeypatch, [
        ("v1", [{"id": "c1", "name": "write_file", "error": None, "arguments": {"path": "src/App.tsx", "content": "one"}}]),
        ("done", []),
        ("v2", [{"id": "c2", "name": "write_file", "error": None, "arguments": {"path": "src/App.tsx", "content": "two"}}]),
        ("done", []),
    ])
    pid = client.post("/v1/builder/projects", json={"skip_plan": True}).json()["id"]
    assert client.post(f"/v1/builder/projects/{pid}/undo").status_code == 409
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "first"})
    client.post(f"/v1/builder/projects/{pid}/chat", json={"text": "second"})
    assert fake_manager.sandbox.files["src/App.tsx"] == "two"
    r = client.post(f"/v1/builder/projects/{pid}/undo")
    assert r.status_code == 200 and r.json()["seq"] == 1
    assert fake_manager.sandbox.files["src/App.tsx"] == "one"
    assert client.post(f"/v1/builder/projects/{pid}/undo").status_code == 409   # already at 1
    fake_manager.sandbox.log = "vite ready\nerror: boom\n"
    assert client.get(f"/v1/builder/projects/{pid}/logs?lines=1").json() == {"lines": ["error: boom"]}
