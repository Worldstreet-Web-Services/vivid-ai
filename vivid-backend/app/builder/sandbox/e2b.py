"""The E2B driver: one microVM from the `vivid-web` template per project.

The template (sandbox-templates/vivid-web) has node_modules installed, git
initialised, and starts the dev server on boot with its output in DEV_LOG.
The manager stores the sandbox id and reconnects to it; a sandbox that has
died is simply replaced, because the snapshot in object storage is the
truth and the sandbox is disposable.

SDK: e2b 2.x (`AsyncSandbox`). Signatures checked against the installed
package, not remembered.
"""
import logging

from e2b import AsyncSandbox, CommandExitException, TimeoutException
from e2b.exceptions import NotFoundException, SandboxException

from app.builder.sandbox.base import RunResult, Sandbox, SandboxError, safe_path
from app.core.config import settings

log = logging.getLogger("vivid.builder.e2b")

APP_ROOT = "/home/user/app"


def _api() -> dict:
    if not settings.E2B_API_KEY:
        raise SandboxError("E2B_API_KEY is not set")
    return {"api_key": settings.E2B_API_KEY}


class E2BSandbox(Sandbox):
    driver = "e2b"
    root = APP_ROOT

    def __init__(self, sb: AsyncSandbox) -> None:
        self._sb = sb
        self.id = sb.sandbox_id

    @classmethod
    async def create(cls, project_id: str) -> "E2BSandbox":
        try:
            sb = await AsyncSandbox.create(
                template=settings.E2B_TEMPLATE,
                timeout=settings.BUILDER_SANDBOX_TIMEOUT_SECONDS,
                metadata={"project_id": project_id},
                **_api())
        except SandboxException as e:
            raise SandboxError(f"could not create sandbox: {e}") from e
        return cls(sb)

    @classmethod
    async def connect(cls, sandbox_id: str) -> "E2BSandbox | None":
        """The running sandbox with this id, or None if it is gone."""
        try:
            sb = await AsyncSandbox.connect(
                sandbox_id, timeout=settings.BUILDER_SANDBOX_TIMEOUT_SECONDS, **_api())
        except NotFoundException:
            return None
        except SandboxException as e:
            log.warning("connect to sandbox %s failed: %s", sandbox_id, e)
            return None
        if not await sb.is_running():
            return None
        return cls(sb)

    # --------------------------------------------------------------- files
    def _abs(self, path: str) -> str:
        return f"{APP_ROOT}/{safe_path(path)}"

    async def read_file(self, path: str) -> str:
        try:
            return await self._sb.files.read(self._abs(path))
        except NotFoundException:
            raise FileNotFoundError(path)
        except SandboxException as e:
            raise SandboxError(f"read failed: {e}") from e

    async def write_file(self, path: str, content: str) -> None:
        try:
            await self._sb.files.write(self._abs(path), content)
        except SandboxException as e:
            raise SandboxError(f"write failed: {e}") from e

    def _anywhere(self, path: str) -> str:
        return path if path.startswith("/") else self._abs(path)

    async def read_bytes(self, path: str) -> bytes:
        try:
            return bytes(await self._sb.files.read(self._anywhere(path), format="bytes"))
        except NotFoundException:
            raise FileNotFoundError(path)
        except SandboxException as e:
            raise SandboxError(f"read failed: {e}") from e

    async def write_bytes(self, path: str, data: bytes) -> None:
        try:
            await self._sb.files.write(self._anywhere(path), data)
        except SandboxException as e:
            raise SandboxError(f"write failed: {e}") from e

    # ------------------------------------------------------------ commands
    async def run(self, cmd: str, timeout: float = 60) -> RunResult:
        try:
            result = await self._sb.commands.run(cmd, cwd=APP_ROOT, timeout=timeout,
                                                 envs={"CI": "1", "NO_COLOR": "1",
                                                       "FORCE_COLOR": "0"})
        except CommandExitException as e:
            return RunResult(e.exit_code, e.stdout, e.stderr)
        except TimeoutException:
            return RunResult(124, "", f"command timed out after {timeout:.0f}s",
                             timed_out=True)
        except SandboxException as e:
            raise SandboxError(f"command failed to start: {e}") from e
        return RunResult(result.exit_code, result.stdout, result.stderr)

    # ------------------------------------------------------------ lifetime
    def preview_url(self) -> str:
        return f"https://{self._sb.get_host(settings.BUILDER_DEV_PORT)}"

    async def touch(self) -> None:
        try:
            await self._sb.set_timeout(settings.BUILDER_SANDBOX_TIMEOUT_SECONDS)
        except SandboxException as e:
            log.warning("set_timeout on %s failed: %s", self.id, e)

    async def is_running(self) -> bool:
        try:
            return await self._sb.is_running()
        except SandboxException:
            return False

    async def kill(self) -> None:
        try:
            await self._sb.kill()
        except SandboxException as e:
            log.warning("kill %s failed: %s", self.id, e)
