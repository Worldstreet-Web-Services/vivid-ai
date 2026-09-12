"""Snapshots and the ledger on an in-memory database and a fake sandbox:
take stores a commit and a tarball, skips unchanged turns, restore brings
files back and reinstalls only when package.json changed, and usage rolls up
by project and by owner."""
import pytest
import pytest_asyncio
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool

from app.builder import blob, pricing, snapshots, usage
from app.builder.loop import ModelCall
from app.core.config import settings
from app.db.models import Base, BuilderProject, User
from tests.builder_fakes import FakeSandbox


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(Vector, "sqlite")
def _vector_on_sqlite(type_, compiler, **kw):
    return "BLOB"


@pytest_asyncio.fixture
async def db():
    # One shared connection: an in-memory SQLite database exists per
    # connection, and background jobs open sessions of their own.
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", poolclass=StaticPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        session.add_all([User(id="u1", email="a@vivid", password_hash="x"),
                         BuilderProject(id="p1", owner_id="u1", name="one"),
                         BuilderProject(id="p2", owner_id="u1", name="two")])
        await session.commit()
        yield session
    await engine.dispose()


@pytest.fixture(autouse=True)
def store(monkeypatch) -> dict:
    data: dict[str, bytes] = {}

    async def put(key, payload, content_type="application/gzip"):
        data[key] = payload

    async def get(key):
        return data[key]
    monkeypatch.setattr(blob, "put", put)
    monkeypatch.setattr(blob, "get", get)
    monkeypatch.setattr(settings, "R2_PREFIX", "t/")
    return data


async def test_take_skips_unchanged_and_numbers_sequentially(db, store):
    sb = FakeSandbox({"src/App.tsx": "a", "package.json": "{}"})
    project = await db.get(BuilderProject, "p1")

    first = await snapshots.take(db, sb, project, "built it")
    assert first.seq == 1 and first.r2_key == "t/projects/p1/snapshots/1.tgz"
    assert first.commit_sha == "sha1" and first.summary == "built it"
    assert project.current_snapshot_id == first.id and store[first.r2_key]

    assert await snapshots.take(db, sb, project, "chat only") is None

    sb.files["src/App.tsx"] = "b"
    second = await snapshots.take(db, sb, project, None)
    assert second.seq == 2 and second.commit_sha == "sha2"
    assert (await snapshots.latest(db, "p1")).seq == 2
    assert (await snapshots.current(db, project)).seq == 2
    project.current_snapshot_id = first.id
    assert (await snapshots.current(db, project)).seq == 1


async def test_take_refuses_oversized(db, store, monkeypatch):
    monkeypatch.setattr(settings, "BUILDER_SNAPSHOT_MAX_BYTES", 10)
    sb = FakeSandbox({"src/App.tsx": "a" * 100})
    with pytest.raises(snapshots.SnapshotError):
        await snapshots.take(db, sb, await db.get(BuilderProject, "p1"), None)
    assert store == {}


async def test_restore_reinstalls_only_when_packages_changed(db, store):
    sb = FakeSandbox({"src/App.tsx": "a", "package.json": '{"deps": 1}'})
    project = await db.get(BuilderProject, "p1")
    one = await snapshots.take(db, sb, project, None)
    sb.files["package.json"] = '{"deps": 2}'
    sb.files["src/App.tsx"] = "b"
    two = await snapshots.take(db, sb, project, None)

    await snapshots.restore(sb, one)
    assert sb.files == {"src/App.tsx": "a", "package.json": '{"deps": 1}'}
    assert sb.installs == 1                      # package.json went 2 -> 1

    sb.files["src/App.tsx"] = "scribble"
    await snapshots.restore(sb, one)
    assert sb.files["src/App.tsx"] == "a" and sb.installs == 1   # same package.json

    await snapshots.restore(sb, two)
    assert sb.files["src/App.tsx"] == "b" and sb.installs == 2


async def test_usage_rollups(db, monkeypatch):
    async def cost_of(model, u):
        return 0.001 if model == "m" else None
    monkeypatch.setattr(pricing, "cost_of", cost_of)

    await usage.record_model(db, "p1", [
        ModelCall("m", "build", {"prompt_tokens": 100, "completion_tokens": 20}),
        ModelCall("unpriced", "build", {"prompt_tokens": 10, "completion_tokens": 1}),
    ])
    await usage.record_storage(db, "p1", 5000, 1)
    await usage.record_storage(db, "p2", 700, 1)
    await db.commit()

    p1 = await usage.rollup(db, project_id="p1")
    assert p1["model_calls"] == 2 and p1["tokens"] == 131
    assert p1["storage_bytes"] == 5000 and p1["cost_usd"] == 0.001
    mine = await usage.rollup(db, user_id="u1")
    assert mine["storage_bytes"] == 5700 and mine["model_calls"] == 2
    assert (await usage.rollup(db, user_id="nobody"))["model_calls"] == 0
    assert (await usage.rollup(db, project_id="p1", since=usage.days_ago(0)))["model_calls"] == 0


def test_snapshot_excludes_git_and_uploads():
    assert ".git" in snapshots.EXCLUDES and "public/uploads" in snapshots.EXCLUDES
