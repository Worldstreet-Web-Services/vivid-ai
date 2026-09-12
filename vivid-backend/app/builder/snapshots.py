"""A project's files after a turn: committed in the sandbox, tarred without
node_modules, stored in the blob store, recorded as a row.

The snapshot is the truth and the sandbox is disposable. `take` runs at the
end of every turn that changed anything; `restore` runs into a fresh sandbox
before it is handed out, and into a live one when the user picks an older
version. `npm install` runs after a restore only when package.json differs
from what the sandbox had, which is what makes a restore a few seconds
rather than a minute.
"""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.builder import blob, usage
from app.builder.sandbox.base import Sandbox, SandboxError
from app.core.config import settings
from app.db.models import BuilderProject, BuilderSnapshot

log = logging.getLogger("vivid.builder.snapshots")

EXCLUDES = ("node_modules", "dist", ".vite", ".vivid-dev.log")
_GIT_IDENTITY = "-c user.name=Vivid -c user.email=builder@vivid"


class SnapshotError(Exception):
    pass


def _tar_path(sandbox: Sandbox) -> str:
    return f"/tmp/vivid-snapshot-{sandbox.id}.tgz"


async def latest(db: AsyncSession, project_id: str) -> BuilderSnapshot | None:
    return (await db.execute(
        select(BuilderSnapshot).where(BuilderSnapshot.project_id == project_id)
        .order_by(BuilderSnapshot.seq.desc()).limit(1))).scalar_one_or_none()


async def current(db: AsyncSession, project: BuilderProject) -> BuilderSnapshot | None:
    """What the preview should show: the one the user restored to, else the
    newest."""
    if project.current_snapshot_id:
        row = await db.get(BuilderSnapshot, project.current_snapshot_id)
        if row is not None:
            return row
    return await latest(db, project.id)


async def take(db: AsyncSession, sandbox: Sandbox, project: BuilderProject,
               summary: str | None) -> BuilderSnapshot | None:
    """Commit and store the sandbox's files. Returns None when nothing
    changed since the last commit (so a chat-only turn stores nothing)."""
    last = await latest(db, project.id)
    seq = (last.seq if last else 0) + 1
    result = await sandbox.run(
        f"git add -A && (git diff --cached --quiet && echo NOCHANGE || "
        f"git {_GIT_IDENTITY} commit -q -m 'turn {seq}') && git rev-parse HEAD",
        timeout=60)
    if not result.ok:
        raise SnapshotError(f"git commit failed: {result.output[:300]}")
    lines = result.stdout.split()
    if "NOCHANGE" in lines and last is not None:
        return None
    sha = lines[-1] if lines else None

    tar = _tar_path(sandbox)
    excludes = " ".join(f"--exclude=./{e}" for e in EXCLUDES)
    result = await sandbox.run(f"tar -czf {tar} {excludes} . && rm -f {tar}.err", timeout=120)
    if not result.ok:
        raise SnapshotError(f"tar failed: {result.output[:300]}")
    try:
        data = await sandbox.read_bytes(tar)
    except SandboxError as e:
        # One retry: a large read over a flaky connection times out more
        # often than the sandbox actually fails.
        log.warning("snapshot read failed once (%s); retrying", e)
        data = await sandbox.read_bytes(tar)
    await sandbox.run(f"rm -f {tar}", timeout=15)
    if len(data) > settings.BUILDER_SNAPSHOT_MAX_BYTES:
        raise SnapshotError(f"snapshot is {len(data)} bytes, over the limit")

    key = blob.snapshot_key(project.id, seq)
    await blob.put(key, data)
    row = BuilderSnapshot(project_id=project.id, seq=seq, r2_key=key, commit_sha=sha,
                          summary=(summary or "")[:500] or None, size_bytes=len(data))
    db.add(row)
    await db.flush()
    project.current_snapshot_id = row.id
    await usage.record_storage(db, project.id, len(data), seq)
    log.info("snapshot %d of project %s: %d bytes", seq, project.id, len(data))
    return row


async def restore(sandbox: Sandbox, snapshot: BuilderSnapshot) -> None:
    """Replace the sandbox's project files with the snapshot's, keeping
    node_modules, and reinstall only if package.json changed."""
    data = await blob.get(snapshot.r2_key)
    tar = _tar_path(sandbox)
    await sandbox.write_bytes(tar, data)
    before = await _package_hash(sandbox)
    result = await sandbox.run(
        "find . -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} + "
        f"&& tar -xzf {tar} && rm -f {tar}", timeout=120)
    if not result.ok:
        raise SnapshotError(f"restore failed: {result.output[:300]}")
    after = await _package_hash(sandbox)
    if after != before:
        log.info("package.json changed in snapshot %d; installing", snapshot.seq)
        result = await sandbox.run("npm install --no-audit --no-fund",
                                   timeout=settings.BUILDER_INSTALL_TIMEOUT)
        if not result.ok:
            raise SnapshotError(f"npm install after restore failed: {result.output[-300:]}")


async def _package_hash(sandbox: Sandbox) -> str:
    result = await sandbox.run("md5sum package.json 2>/dev/null || md5 -q package.json",
                               timeout=15)
    return result.stdout.split()[0] if result.stdout.split() else ""


async def delete_all(project_id: str) -> None:
    """Objects of a deleted project. Rows cascade; this is the bucket."""
    try:
        await blob.delete_prefix(f"{settings.R2_PREFIX}projects/{project_id}/")
    except Exception as e:                        # already logged as best effort
        log.warning("snapshot cleanup for %s failed: %s", project_id, e)
