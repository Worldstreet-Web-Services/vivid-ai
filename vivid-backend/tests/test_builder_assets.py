"""Uploaded assets: naming, limits, the copy in the sandbox, what the model
is told, and the images the plan model is shown."""
import struct
import zlib

import pytest
import pytest_asyncio
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool

from app.builder import assets, blob
from app.core.config import settings
from app.db.models import Base, BuilderProject, User
from tests.builder_fakes import FakeSandbox


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(Vector, "sqlite")
def _vector_on_sqlite(type_, compiler, **kw):
    return "BLOB"


def png(w: int, h: int) -> bytes:
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", poolclass=StaticPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        session.add_all([User(id="u1", email="a@vivid", password_hash="x"),
                         BuilderProject(id="p1", owner_id="u1", name="shop")])
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
    monkeypatch.setattr(blob, "presigned_url", lambda key, expires_in=3600: f"https://r2/{key}")
    monkeypatch.setattr(settings, "R2_PREFIX", "t/")
    return data


def test_safe_name():
    assert assets.safe_name("Air Max 90.PNG", "image/png") == "air-max-90.png"
    assert assets.safe_name("../../etc/passwd", "image/svg+xml") == "passwd.svg"
    assert assets.safe_name("logo", "image/jpeg") == "logo.jpg"
    assert assets.safe_name("photo.jpeg", "image/jpeg") == "photo.jpeg"
    assert assets.safe_name("", "font/woff2") == "file.woff2"


async def test_add_validates_and_replaces(db, store, monkeypatch):
    a = await assets.add(db, "p1", "Logo.png", "image/png", png(40, 20))
    assert a.name == "logo.png" and a.meta == {"width": 40, "height": 20}
    assert a.r2_key == f"t/projects/p1/assets/{a.id}-logo.png" and store[a.r2_key]
    assert assets.public_path(a) == "/uploads/logo.png"
    assert assets.sandbox_path(a) == "public/uploads/logo.png"

    again = await assets.add(db, "p1", "logo.png", "image/png", png(8, 8))
    assert again.id == a.id and again.meta == {"width": 8, "height": 8}
    assert len(await assets.list_for(db, "p1")) == 1

    with pytest.raises(assets.AssetError, match="not supported"):
        await assets.add(db, "p1", "x.exe", "application/octet-stream", b"MZ")
    monkeypatch.setattr(settings, "BUILDER_ASSET_MAX_BYTES", 10)
    with pytest.raises(assets.AssetError, match="over"):
        await assets.add(db, "p1", "big.png", "image/png", png(50, 50))
    monkeypatch.setattr(settings, "BUILDER_ASSET_MAX_BYTES", 10_000)
    monkeypatch.setattr(settings, "BUILDER_ASSETS_PER_PROJECT", 1)
    with pytest.raises(assets.AssetError, match="as many files"):
        await assets.add(db, "p1", "two.png", "image/png", png(1, 1))


async def test_sync_writes_only_missing_and_describe(db, store):
    logo = await assets.add(db, "p1", "logo.png", "image/png", png(10, 10))
    shoe = await assets.add(db, "p1", "Shoe One.jpg", "image/jpeg", b"\xff\xd8\xff\xe0jpeg")
    rows = await assets.list_for(db, "p1")
    sb = FakeSandbox({"src/App.tsx": "x", "public/uploads/logo.png": "already"})
    assert await assets.sync(sb, rows) == 1
    assert sb.blobs["public/uploads/shoe-one.jpg"] == b"\xff\xd8\xff\xe0jpeg"
    assert "public/uploads/logo.png" not in sb.blobs          # left alone

    text = assets.describe(rows)
    assert text.startswith("## Files the user uploaded")
    assert "- /uploads/logo.png (image/png" in text and "10x10" in text
    assert "- /uploads/shoe-one.jpg (image/jpeg" in text
    assert assets.describe([]) == ""
    assert assets.image_urls(rows) == [f"https://r2/{logo.r2_key}", f"https://r2/{shoe.r2_key}"]
    assert assets.image_urls(rows, limit=1) == [f"https://r2/{shoe.r2_key}"]
