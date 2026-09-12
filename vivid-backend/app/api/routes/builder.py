"""The app builder: /v1/builder.

    POST   /builder/projects                 create
    GET    /builder/projects                 mine
    GET    /builder/projects/{id}
    PATCH  /builder/projects/{id}            rename, edit the spec
    DELETE /builder/projects/{id}            also kills the sandbox
    GET    /builder/projects/{id}/messages   the thread, parts as streamed
    POST   /builder/projects/{id}/chat       one turn; answers as an AI SDK
                                             UI Message Stream (SSE)
    POST   /builder/projects/{id}/cancel     stop the running turn
    GET    /builder/projects/{id}/preview    the sandbox URL (starts one)
    GET    /builder/projects/{id}/files      source file list
    GET    /builder/projects/{id}/files/{path}

One turn per project at a time (409 otherwise). The stream is the contract
for any client: see docs/builder.md.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.builder import routing, stream
from app.builder.loop import TurnRunner, turns
from app.builder.sandbox.base import PathError, SandboxError, safe_path
from app.builder.sandbox.manager import manager
from app.core.config import settings
from app.core.errors import APIError
from app.db.models import BuilderMessage, BuilderProject, BuilderSnapshot, User
from app.db.session import async_session
from app.schemas.builder import (CancelOut, ChatIn, FileOut, FilesOut, MessageOut,
                                 PreviewOut, ProjectCreate, ProjectOut, ProjectUpdate)
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
    project = BuilderProject(owner_id=user.id, name=body.name.strip() or "Untitled app")
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
    history = _history(list(rows.scalars()))
    stage = routing.stage_for(await _latest_seq(project_id, db))

    cancel = turns.start(project_id)
    if cancel is None:
        raise APIError(409, "busy", "A turn is already running for this project.")

    user_msg = BuilderMessage(project_id=project_id, role="user",
                              parts=[{"type": "text", "text": body.text}])
    db.add(user_msg)
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()

    spec_md, recent = project.spec_md, _recent(project)

    async def generate():
        collector = stream.PartsCollector()
        runner = None
        try:
            try:
                sandbox = await manager.get_or_create(project_id, redis)
            except SandboxError as e:
                log.error("sandbox for project %s failed: %s", project_id, e)
                yield stream.frame(stream.error(
                    "The workspace could not be started. Please try again."))
                return
            runner = TurnRunner(sandbox, stage, history, body.text, spec_md, recent,
                                cancelled=cancel.is_set)
            async for part in runner.run():
                collector.add(part)
                yield stream.frame(part)
        except Exception as e:                     # never a half-open stream
            log.exception("builder turn failed for project %s", project_id)
            yield stream.frame(stream.error(provider.scrub(str(e))))
        finally:
            # Stored BEFORE the terminator: a client that fetches the thread
            # the moment it sees [DONE] must find the assistant message.
            turns.finish(project_id)
            await manager.touch(project_id)
            await _persist_turn(project_id, collector, runner)
            yield stream.DONE

    return StreamingResponse(generate(), media_type=stream.MEDIA_TYPE,
                             headers=stream.HEADERS)


async def _persist_turn(project_id: str, collector: stream.PartsCollector,
                        runner: TurnRunner | None) -> None:
    """Own session: the request's session may be torn down before a
    streaming response finishes."""
    if not collector.parts:
        return
    try:
        async with async_session() as db:
            project = await db.get(BuilderProject, project_id)
            if project is None:
                return
            db.add(BuilderMessage(project_id=project_id, role="assistant",
                                  parts=collector.parts,
                                  model=runner.result.model if runner else None))
            if runner and runner.result.touched:
                recent = [runner.result.touched] + list(project.recent_files or [])
                project.recent_files = recent[:RECENT_TURNS]
            await db.commit()
    except Exception as e:
        log.error("could not store the assistant message for %s: %s", project_id, e)


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
    try:
        sandbox = await manager.get_or_create(project_id, request.app.state.redis)
    except SandboxError as e:
        log.error("preview for project %s failed: %s", project_id, e)
        raise APIError(503, "sandbox_unavailable",
                       "The workspace could not be started. Please try again.")
    await manager.touch(project_id)
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


async def _sandbox(project_id: str, request: Request):
    try:
        sandbox = await manager.get_or_create(project_id, request.app.state.redis)
    except SandboxError as e:
        log.error("sandbox for project %s failed: %s", project_id, e)
        raise APIError(503, "sandbox_unavailable",
                       "The workspace could not be started. Please try again.")
    await manager.touch(project_id)
    return sandbox
