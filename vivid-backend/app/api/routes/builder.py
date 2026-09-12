"""The app builder: /v1/builder.

    POST   /builder/projects                 create
    GET    /builder/projects                 mine
    GET    /builder/projects/{id}
    PATCH  /builder/projects/{id}            rename, edit the spec
    DELETE /builder/projects/{id}            also kills the sandbox
    GET    /builder/projects/{id}/messages   the thread, parts as streamed
    POST   /builder/projects/{id}/chat       one turn; answers as an AI SDK
                                             UI Message Stream (SSE). In plan
                                             mode the turn asks questions or
                                             writes the spec; no sandbox.
    POST   /builder/projects/{id}/build      leave plan mode; spec.md goes
                                             into the sandbox
    POST   /builder/projects/{id}/cancel     stop the running turn
    GET    /builder/projects/{id}/preview    the sandbox URL (starts one)
    GET    /builder/projects/{id}/files      source file list
    GET    /builder/projects/{id}/files/{path}
    GET    /builder/projects/{id}/snapshots  one per turn that changed files
    POST   /builder/projects/{id}/snapshots/{seq}/restore
    GET    /builder/projects/{id}/usage      this project's metered totals
    POST   /builder/projects/{id}/supabase   link a Supabase project (byo)
    DELETE /builder/projects/{id}/supabase   unlink
    POST   /builder/projects/{id}/publish    build and put the app on a live URL (202)
    GET    /builder/projects/{id}/publishes  history, newest first
    GET    /builder/projects/{id}/publishes/{publish_id}

One turn per project at a time (409 otherwise). The stream is the contract
for any client: see docs/builder.md.
"""
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.builder import (planning, publish, routing, secrets, snapshots, stream, supabase,
                         tools, usage)
from app.builder.loop import ModelCall, TurnRunner, turns
from app.builder.planning import PlanRunner
from app.builder.sandbox.base import PathError, SandboxError, safe_path
from app.builder.sandbox.manager import manager
from app.core.config import settings
from app.core.errors import APIError
from app.db.models import (BuilderMessage, BuilderProject, BuilderPublish, BuilderSnapshot,
                           Connector, User)
from app.services.connectors import supabase as supabase_connector
from app.db.session import async_session
from app.schemas.builder import (CancelOut, ChatIn, FileOut, FilesOut, MessageOut,
                                 PreviewOut, ProjectCreate, ProjectOut, ProjectUpdate,
                                 PublishOut, SnapshotOut, SupabaseLinkIn, UsageOut)
from app.services import rate_limit
from app.services.models_gateway import provider

router = APIRouter(prefix="/builder", tags=["builder"])
log = logging.getLogger("vivid.builder")

#: How many turns back a touched file stays in the context block.
RECENT_TURNS = 2


async def _owned(project_id: str, user: User, db: AsyncSession) -> BuilderProject:
    project = await db.get(BuilderProject, project_id)
    if project is None or project.owner_id != user.id:
        raise APIError(404, "not_found", "Project not found")
    return project


async def _latest_seq(project_id: str, db: AsyncSession) -> int:
    row = (await db.execute(
        select(BuilderSnapshot.seq).where(BuilderSnapshot.project_id == project_id)
        .order_by(BuilderSnapshot.seq.desc()).limit(1))).scalar_one_or_none()
    return row or 0


# ------------------------------------------------------------- projects
@router.post("/projects", response_model=ProjectOut, status_code=201)
async def create_project(body: ProjectCreate, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    project = BuilderProject(owner_id=user.id, name=body.name.strip() or "Untitled app",
                             mode="build" if body.skip_plan else "plan")
    db.add(project)
    await db.commit()
    return project


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(BuilderProject)
                            .where(BuilderProject.owner_id == user.id)
                            .order_by(BuilderProject.updated_at.desc()))
    return list(rows.scalars())


@router.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    return await _owned(project_id, user, db)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, body: ProjectUpdate,
                         user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    project = await _owned(project_id, user, db)
    if body.name is not None:
        project.name = body.name.strip() or project.name
    if body.spec_md is not None:
        project.spec_md = body.spec_md
    await db.commit()
    return project


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: str, request: Request,
                         user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    project = await _owned(project_id, user, db)
    turns.cancel(project_id)
    await manager.kill(project_id, request.app.state.redis)
    await db.delete(project)
    await db.commit()
    await snapshots.delete_all(project_id)


# ------------------------------------------------------------- messages
@router.get("/projects/{project_id}/messages", response_model=list[MessageOut])
async def list_messages(project_id: str, user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    rows = await db.execute(select(BuilderMessage)
                            .where(BuilderMessage.project_id == project_id)
                            .order_by(BuilderMessage.created_at))
    return list(rows.scalars())


def _history(messages: list[BuilderMessage]) -> list[dict]:
    """Past turns as the model sees them: prose only. Tool calls from
    earlier turns are not replayed; the context block carries the files
    they touched, and the model re-reads what it needs."""
    out = []
    for m in messages:
        text = stream.text_of(m.parts or [])
        if text:
            out.append({"role": m.role, "content": text})
    return out


def _recent(project: BuilderProject) -> list[str]:
    seen: list[str] = []
    for turn in (project.recent_files or [])[:RECENT_TURNS]:
        for path in turn:
            if path not in seen:
                seen.append(path)
    return seen


@router.post("/projects/{project_id}/chat")
async def chat(project_id: str, body: ChatIn, request: Request,
               user: User = Depends(get_current_user),
               db: AsyncSession = Depends(get_db)):
    """One turn. The response is `text/event-stream` in the AI SDK UI
    Message Stream (v1) shape; the user message is stored before the model
    is called and the assistant message when the stream ends."""
    project = await _owned(project_id, user, db)
    redis = request.app.state.redis
    if not await rate_limit.check_bucket(redis, f"builder:{user.id}",
                                         settings.BUILDER_RATE_LIMIT_PER_MINUTE):
        raise APIError(429, "rate_limited",
                       "Too many builder messages this minute. Please wait a moment.")
    if not routing.endpoint_for(routing.BUILD).configured:
        raise APIError(503, "not_configured", "The app builder is not configured.")

    rows = await db.execute(select(BuilderMessage)
                            .where(BuilderMessage.project_id == project_id)
                            .order_by(BuilderMessage.created_at))
    stored = list(rows.scalars())
    planning_mode = project.mode == "plan"
    history = planning.history_from_parts(stored) if planning_mode else _history(stored)
    stage = routing.stage_for(await _latest_seq(project_id, db))

    cancel = turns.start(project_id)
    if cancel is None:
        raise APIError(409, "busy", "A turn is already running for this project.")

    user_parts = [{"type": "text", "text": body.text}]
    user_parts += [{"type": "file", "mediaType": "image/*", "url": u} for u in body.images]
    user_msg = BuilderMessage(project_id=project_id, role="user", parts=user_parts)
    db.add(user_msg)
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()

    spec_md, recent = project.spec_md, _recent(project)
    backend = None if planning_mode else await _backend_for(project, user, db)
    env_vars = None if planning_mode else await _env_for(project, db)

    async def generate():
        collector = stream.PartsCollector()
        runner = None
        try:
            if planning_mode:
                runner = PlanRunner(history, body.text, body.images, cancelled=cancel.is_set)
                async for part in runner.run():
                    collector.add(part)
                    yield stream.frame(part)
                turns.finish(project_id)
                await _persist_plan_turn(project_id, collector, runner)
                yield stream.DONE
                return
            try:
                sandbox = await _start_sandbox(project_id, redis)
                await _sync_spec(sandbox, spec_md)
                await _sync_env(sandbox, env_vars)
            except (SandboxError, snapshots.SnapshotError) as e:
                log.error("sandbox for project %s failed: %s", project_id, e)
                yield stream.frame(stream.error(
                    "The workspace could not be started. Please try again."))
                return
            runner = TurnRunner(sandbox, stage, history, body.text, spec_md, recent,
                                cancelled=cancel.is_set, backend=backend)
            async for part in runner.run():
                collector.add(part)
                yield stream.frame(part)
        except Exception as e:                     # never a half-open stream
            log.exception("builder turn failed for project %s", project_id)
            yield stream.frame(stream.error(provider.scrub(str(e))))
        finally:
            if not planning_mode:
                # Stored BEFORE the terminator: a client that fetches the
                # thread the moment it sees [DONE] must find the message.
                turns.finish(project_id)
                await manager.touch(project_id)
                snapshot = await _persist_turn(project_id, collector, runner)
                if snapshot is not None:
                    yield stream.frame(stream.data("snapshot", {
                        "id": snapshot.id, "seq": snapshot.seq}))
                yield stream.DONE
            else:
                turns.finish(project_id)

    return StreamingResponse(generate(), media_type=stream.MEDIA_TYPE,
                             headers=stream.HEADERS)


async def _persist_turn(project_id: str, collector: stream.PartsCollector,
                        runner: TurnRunner | None):
    """The assistant message, the usage rows and the snapshot, in one
    transaction on its own session (the request's session may be torn down
    before a streaming response finishes). Returns the snapshot row, if the
    turn changed any file."""
    if not collector.parts:
        return None
    snapshot = None
    try:
        async with async_session() as db:
            project = await db.get(BuilderProject, project_id)
            if project is None:
                return None
            db.add(BuilderMessage(project_id=project_id, role="assistant",
                                  parts=collector.parts,
                                  model=runner.result.model if runner else None))
            if runner is not None:
                if runner.result.touched:
                    recent = [runner.result.touched] + list(project.recent_files or [])
                    project.recent_files = recent[:RECENT_TURNS]
                await usage.record_model(db, project_id, runner.result.calls)
                try:
                    snapshot = await snapshots.take(db, runner.sandbox, project,
                                                    collector.text())
                except (snapshots.SnapshotError, SandboxError, Exception) as e:
                    # The message and usage still land; the next turn that
                    # changes a file snapshots this one's work too.
                    log.error("snapshot for %s failed: %s", project_id, e)
            await db.commit()
    except Exception as e:
        log.error("could not store the turn for %s: %s", project_id, e)
    return snapshot


async def _persist_plan_turn(project_id: str, collector: stream.PartsCollector,
                             runner: PlanRunner) -> None:
    if not collector.parts:
        return
    try:
        async with async_session() as db:
            project = await db.get(BuilderProject, project_id)
            if project is None:
                return
            db.add(BuilderMessage(project_id=project_id, role="assistant",
                                  parts=collector.parts, model=runner.result.model))
            if runner.result.spec_md:
                project.spec_md = runner.result.spec_md
            await usage.record_model(db, project_id, [
                ModelCall(model, routing.PLAN, u) for model, u in runner.result.calls])
            await db.commit()
    except Exception as e:
        log.error("could not store the plan turn for %s: %s", project_id, e)


async def _sync_spec(sandbox, spec_md: str | None) -> None:
    """spec.md in the sandbox mirrors the project's spec, so the file the
    model can read and the text in its prompt never disagree, and the next
    snapshot carries it."""
    if not spec_md:
        return
    try:
        current = await sandbox.read_file("spec.md")
    except FileNotFoundError:
        current = None
    if current != spec_md:
        await sandbox.write_file("spec.md", spec_md)


async def _sync_env(sandbox, env_vars: dict[str, str] | None) -> None:
    """The app's .env mirrors the linked backend. Not in git (the template
    ignores it), so it is rewritten on every build turn and never lands in
    a snapshot."""
    if not env_vars:
        return
    wanted = "".join(f"{k}={v}\n" for k, v in env_vars.items())
    try:
        current = await sandbox.read_file(".env")
    except FileNotFoundError:
        current = None
    if current != wanted:
        await sandbox.write_file(".env", wanted)


async def _env_for(project: BuilderProject, db: AsyncSession) -> dict[str, str] | None:
    if project.backend_mode == "none":
        return None
    url = await secrets.get_secret(db, project.id, "SUPABASE_URL")
    anon = await secrets.get_secret(db, project.id, "SUPABASE_ANON_KEY")
    if not (url and anon):
        return None
    return {"VITE_SUPABASE_URL": url, "VITE_SUPABASE_ANON_KEY": anon}


async def _supabase_connector(user_id: str, db: AsyncSession) -> Connector | None:
    return (await db.execute(
        select(Connector).where(Connector.user_id == user_id,
                                Connector.provider == "supabase"))).scalar_one_or_none()


async def _backend_for(project: BuilderProject, user: User,
                       db: AsyncSession) -> tools.Backend | None:
    """The Management API context for this turn's tools: the user's own
    connector for a byo project. A project linked with pasted keys but no
    connector gets the client env only, and no tools."""
    if project.backend_mode != "byo" or not project.supabase_project_ref:
        return None
    connector = await _supabase_connector(user.id, db)
    if connector is None:
        return None
    try:
        token = await supabase_connector.access_token(db, connector)
    except supabase.SupabaseError as e:
        log.warning("supabase token refresh failed for %s: %s", user.id, e.public)
        return None
    return tools.Backend(ref=project.supabase_project_ref, token=token)


# -------------------------------------------------------------- supabase
@router.post("/projects/{project_id}/supabase", response_model=ProjectOut)
async def link_supabase(project_id: str, body: SupabaseLinkIn, request: Request,
                        user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    """Point this project at a Supabase project of the user's.

    With a Supabase connector, `project_ref` is enough: the keys are read
    through the Management API and the builder's migration, function and
    secret tools become available. Without one, `url` and `anon_key` can
    be pasted: the app gets its client env, the tools stay off.
    """
    project = await _owned(project_id, user, db)
    if not secrets.configured():
        raise APIError(503, "not_configured", "Secrets storage is not configured.")
    connector = await _supabase_connector(user.id, db)
    if connector is not None and not body.anon_key:
        try:
            token = await supabase_connector.access_token(db, connector)
            api = supabase.Management(token)
            known = {p.ref for p in await api.projects()}
            if body.project_ref not in known:
                raise APIError(404, "not_found",
                               "That Supabase project is not in the connected account.")
            keys = await api.api_keys(body.project_ref)
        except supabase.SupabaseError as e:
            raise APIError(502, "upstream_error", f"Supabase: {e.public}")
        url, anon = keys["url"], keys["anon"]
    else:
        if not body.anon_key:
            raise APIError(400, "bad_request",
                           "Connect Supabase first, or pass url and anon_key.")
        url = body.url or f"https://{body.project_ref}.supabase.co"
        anon = body.anon_key
    await secrets.set_secret(db, project_id, "SUPABASE_URL", url)
    await secrets.set_secret(db, project_id, "SUPABASE_ANON_KEY", anon)
    project.backend_mode = "byo"
    project.supabase_project_ref = body.project_ref
    await db.commit()
    sandbox = manager.peek(project_id)
    if sandbox is not None:
        await _sync_env(sandbox, {"VITE_SUPABASE_URL": url, "VITE_SUPABASE_ANON_KEY": anon})
    return project


@router.delete("/projects/{project_id}/supabase", response_model=ProjectOut)
async def unlink_supabase(project_id: str, user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    project = await _owned(project_id, user, db)
    project.backend_mode = "none"
    project.supabase_project_ref = None
    await secrets.delete_secret(db, project_id, "SUPABASE_URL")
    await secrets.delete_secret(db, project_id, "SUPABASE_ANON_KEY")
    await db.commit()
    return project


# --------------------------------------------------------------- publish
#: Publish jobs in flight, so a crash in one is logged and a second click
#: while one runs is refused.
_publishing: dict[str, asyncio.Task] = {}


@router.post("/projects/{project_id}/publish", response_model=PublishOut, status_code=202)
async def start_publish(project_id: str, request: Request,
                        user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    """Build the current files and put them on the project's live URL. The
    row comes back `pending`; poll it until `live` or `failed`."""
    project = await _owned(project_id, user, db)
    if not publish.configured():
        raise APIError(503, "not_configured", "Publishing is not configured.")
    if turns.running(project_id):
        raise APIError(409, "busy", "Wait for the running turn to finish first.")
    if project_id in _publishing and not _publishing[project_id].done():
        raise APIError(409, "busy", "A publish is already running for this project.")
    row = BuilderPublish(project_id=project_id, snapshot_id=project.current_snapshot_id,
                         status="pending")
    db.add(row)
    await db.commit()
    alias = publish.alias_for(project.name, project.id)
    _publishing[project_id] = asyncio.create_task(
        _run_publish(project_id, row.id, alias, request.app.state.redis))
    return row


async def _run_publish(project_id: str, publish_id: str, alias: str, redis) -> None:
    async def update(**fields):
        async with async_session() as db:
            row = await db.get(BuilderPublish, publish_id)
            if row is None:
                return
            for k, v in fields.items():
                setattr(row, k, v)
            if fields.get("status") == "live":
                project = await db.get(BuilderProject, project_id)
                if project is not None:
                    project.published_url = fields.get("url")
            await db.commit()

    try:
        await update(status="building")
        sandbox = await _start_sandbox(project_id, redis)
        site = await publish.build_site(sandbox)
        await manager.touch(project_id)
        pages = publish.Pages()
        await pages.deploy(site, alias, f"vivid publish {publish_id[:8]}")
        url = publish.public_url(alias)
        await publish.wait_until_live(url)
        await update(status="live", url=url)
        log.info("project %s published at %s", project_id, url)
    except (publish.PublishError, SandboxError, snapshots.SnapshotError) as e:
        await update(status="failed", error=str(e)[:2000])
    except Exception as e:                          # never a stuck "building"
        log.exception("publish %s failed", publish_id)
        await update(status="failed", error=provider.scrub(str(e))[:500])
    finally:
        _publishing.pop(project_id, None)


@router.get("/projects/{project_id}/publishes", response_model=list[PublishOut])
async def list_publishes(project_id: str, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    rows = await db.execute(select(BuilderPublish)
                            .where(BuilderPublish.project_id == project_id)
                            .order_by(BuilderPublish.created_at.desc()))
    return list(rows.scalars())


@router.get("/projects/{project_id}/publishes/{publish_id}", response_model=PublishOut)
async def get_publish(project_id: str, publish_id: str,
                      user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    row = await db.get(BuilderPublish, publish_id)
    if row is None or row.project_id != project_id:
        raise APIError(404, "not_found", "No such publish")
    return row


@router.post("/projects/{project_id}/build", response_model=ProjectOut)
async def start_build(project_id: str, request: Request,
                      user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    """Leave plan mode. The spec, if any, is what the builder works to; a
    project may also start building with no spec at all."""
    project = await _owned(project_id, user, db)
    if turns.running(project_id):
        raise APIError(409, "busy", "Wait for the running turn to finish first.")
    if project.mode != "build":
        project.mode = "build"
        await db.commit()
    return project


@router.post("/projects/{project_id}/cancel", response_model=CancelOut)
async def cancel_turn(project_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    return CancelOut(cancelled=turns.cancel(project_id))


# -------------------------------------------------------------- preview
@router.get("/projects/{project_id}/preview", response_model=PreviewOut)
async def preview(project_id: str, request: Request,
                  user: User = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    sandbox = await _sandbox(project_id, request)
    return PreviewOut(url=sandbox.preview_url(), sandbox_id=sandbox.id,
                      driver=sandbox.driver)


@router.get("/projects/{project_id}/files", response_model=FilesOut)
async def list_files(project_id: str, request: Request,
                     user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    sandbox = await _sandbox(project_id, request)
    return FilesOut(files=await sandbox.list_files())


@router.get("/projects/{project_id}/files/{path:path}", response_model=FileOut)
async def read_file(project_id: str, path: str, request: Request,
                    user: User = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    try:
        clean = safe_path(path)
    except PathError as e:
        raise APIError(400, "bad_path", str(e))
    sandbox = await _sandbox(project_id, request)
    try:
        return FileOut(path=clean, content=await sandbox.read_file(clean))
    except FileNotFoundError:
        raise APIError(404, "not_found", "File not found")


async def _start_sandbox(project_id: str, redis):
    """The project's sandbox, restoring its current snapshot into a fresh
    one. The restore reads the snapshot row on its own session because the
    manager may call it long after the request's session was used."""
    async def restore(sandbox):
        async with async_session() as db:
            project = await db.get(BuilderProject, project_id)
            row = await snapshots.current(db, project) if project else None
        if row is not None:
            await snapshots.restore(sandbox, row)
    sandbox = await manager.get_or_create(project_id, redis, restore=restore)
    await manager.touch(project_id)
    return sandbox


async def _sandbox(project_id: str, request: Request):
    try:
        return await _start_sandbox(project_id, request.app.state.redis)
    except (SandboxError, snapshots.SnapshotError) as e:
        log.error("sandbox for project %s failed: %s", project_id, e)
        raise APIError(503, "sandbox_unavailable",
                       "The workspace could not be started. Please try again.")


# ------------------------------------------------------------ snapshots
@router.get("/projects/{project_id}/snapshots", response_model=list[SnapshotOut])
async def list_snapshots(project_id: str, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    rows = await db.execute(select(BuilderSnapshot)
                            .where(BuilderSnapshot.project_id == project_id)
                            .order_by(BuilderSnapshot.seq))
    return list(rows.scalars())


@router.post("/projects/{project_id}/snapshots/{seq}/restore", response_model=SnapshotOut)
async def restore_snapshot(project_id: str, seq: int, request: Request,
                           user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    """Make an older version current. A live sandbox gets the files now;
    otherwise the next sandbox starts from it. The next turn's snapshot
    continues the sequence, so nothing is lost by going back."""
    project = await _owned(project_id, user, db)
    if turns.running(project_id):
        raise APIError(409, "busy", "Wait for the running turn to finish first.")
    row = (await db.execute(select(BuilderSnapshot)
                            .where(BuilderSnapshot.project_id == project_id,
                                   BuilderSnapshot.seq == seq))).scalar_one_or_none()
    if row is None:
        raise APIError(404, "not_found", "No such version")
    project.current_snapshot_id = row.id
    await db.commit()
    sandbox = manager.peek(project_id)
    if sandbox is not None:
        try:
            await snapshots.restore(sandbox, row)
        except (snapshots.SnapshotError, SandboxError) as e:
            log.error("restore of %s seq %d into live sandbox failed: %s", project_id, seq, e)
            # Replace the sandbox rather than leave it half-restored.
            await manager.kill(project_id, request.app.state.redis)
    await manager.touch(project_id)
    return row


@router.get("/projects/{project_id}/usage", response_model=UsageOut)
async def project_usage(project_id: str, user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    await _owned(project_id, user, db)
    return UsageOut(**await usage.rollup(db, project_id=project_id))
