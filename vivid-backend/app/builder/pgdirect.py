"""Migrations over a plain Postgres connection.

Supabase's dashboard shows every project's connection string; a user who
pastes it gives the builder the one thing the migration tool needs, with
no account link, OAuth app or personal token. Each migration runs in one
transaction and is recorded in supabase_migrations.schema_migrations, the
table the Supabase CLI and dashboard read, so the history stays honest.
Edge functions and secrets still need the Management API.
"""
import logging
import re
from datetime import datetime, timezone

import asyncpg

from app.core.config import settings

log = logging.getLogger("vivid.builder.pgdirect")

_DSN = re.compile(r"^postgres(ql)?://")


class DirectError(Exception):
    """Text the user or the model may see: no credentials in it."""


def _clean(e: Exception) -> str:
    text = str(e) or e.__class__.__name__
    return re.sub(r"password=\S+", "password=***", text)[:300]


def clean_error(e: Exception) -> str:
    return _clean(e)


def valid(dsn: str) -> bool:
    return bool(dsn and _DSN.match(dsn.strip()))


async def _connect(dsn: str) -> asyncpg.Connection:
    if not valid(dsn):
        raise DirectError("that is not a postgresql:// connection string")
    try:
        return await asyncpg.connect(dsn.strip(), timeout=settings.SUPABASE_API_TIMEOUT,
                                     statement_cache_size=0)
    except (OSError, asyncpg.PostgresError, ValueError, TimeoutError) as e:
        raise DirectError(_clean(e))


async def verify(dsn: str) -> None:
    conn = await _connect(dsn)
    try:
        await conn.fetchval("select 1")
    finally:
        await conn.close()


async def apply_migration(dsn: str, sql: str, name: str) -> None:
    conn = await _connect(dsn)
    try:
        async with conn.transaction():
            await conn.execute(sql)
            await conn.execute(
                "create schema if not exists supabase_migrations; "
                "create table if not exists supabase_migrations.schema_migrations "
                "(version text primary key, statements text[], name text)")
            version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")[:-4]
            await conn.execute(
                "insert into supabase_migrations.schema_migrations (version, statements, name) "
                "values ($1, $2, $3) on conflict (version) do nothing",
                version, [sql], name)
    except asyncpg.PostgresError as e:
        raise DirectError(_clean(e))
    finally:
        await conn.close()


async def query(dsn: str, sql: str, limit: int = 51) -> list[dict]:
    """A read-only SELECT in a read-only transaction, capped in rows."""
    conn = await _connect(dsn)
    try:
        async with conn.transaction(readonly=True):
            records = await conn.fetch(f"select * from ({sql}) as q limit {int(limit)}")
        return [dict(r) for r in records]
    except asyncpg.PostgresError as e:
        raise DirectError(_clean(e))
    finally:
        await conn.close()
