"""An in-memory sandbox for the builder's unit tests.

Files live in a dict; commands are answered by a script the test sets up.
The typecheck is the one command the tools care about, so it is scripted by
name: `fake.tsc_output = "..."` makes the next typecheck fail with that text.
"""
import posixpath

from app.builder.sandbox.base import RunResult, Sandbox, safe_path


class FakeSandbox(Sandbox):
    driver = "fake"
    root = "/app"

    def __init__(self, files: dict[str, str] | None = None) -> None:
        self.id = "fake_1"
        self.files: dict[str, str] = dict(files or {})
        self.commands: list[str] = []
        self.tsc_output: str = ""
        self.killed = False
        self.log = "vite ready\n"
        #: command substring -> RunResult, checked in order.
        self.responses: list[tuple[str, RunResult]] = []

    async def read_file(self, path: str) -> str:
        path = safe_path(path)
        if path not in self.files:
            raise FileNotFoundError(path)
        return self.files[path]

    async def write_file(self, path: str, content: str) -> None:
        self.files[safe_path(path)] = content

    async def list_files(self) -> list[str]:
        return sorted(self.files)

    async def dev_server_logs(self, lines: int = 100) -> str:
        return "\n".join(self.log.splitlines()[-lines:])

    async def run(self, cmd: str, timeout: float = 60) -> RunResult:
        self.commands.append(cmd)
        if "tsc --noEmit" in cmd:
            if self.tsc_output:
                return RunResult(2, self.tsc_output, "")
            return RunResult(0, "", "")
        for needle, result in self.responses:
            if needle in cmd:
                return result
        return RunResult(0, f"ran: {cmd}", "")

    def preview_url(self) -> str:
        return "http://fake:5173"

    async def kill(self) -> None:
        self.killed = True

    async def is_running(self) -> bool:
        return not self.killed


def tree(files: dict[str, str]) -> list[str]:
    return sorted(posixpath.normpath(p) for p in files)
