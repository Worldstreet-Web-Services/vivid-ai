"""Build (or rebuild) the `vivid-web` E2B template.

    E2B_API_KEY=... python template.py

Everything the sandbox needs is in this directory: the Vite project and
start.sh, which the sandbox runs on boot. The build installs node_modules
and makes the first git commit, so a sandbox boots straight into a working
dev server; the template is ready when :5173 answers.

Rebuild after changing package.json or any template file; running sandboxes
keep the old image, new ones get the new one.
"""
import os
import sys
from pathlib import Path

from e2b import Template, default_build_logger, wait_for_port

HERE = Path(__file__).resolve().parent
NAME = os.environ.get("E2B_TEMPLATE", "vivid-web")
APP = "/home/user/app"

#: Copied into the image. node_modules is installed there, never uploaded.
FILES = ["package.json", "index.html", "vite.config.ts", "tsconfig.json",
         "tsconfig.app.json", "tsconfig.node.json", "components.json",
         ".gitignore", "start.sh"]


def main() -> int:
    if not os.environ.get("E2B_API_KEY"):
        print("E2B_API_KEY is not set", file=sys.stderr)
        return 2
    os.chdir(HERE)
    template = (
        Template()
        .from_node_image("22")
        # git for snapshots and file listing; bash for the tools' shell.
        # Build steps run as `user` unless told otherwise; only apt needs root.
        .run_cmd("apt-get update && apt-get install -y --no-install-recommends git bash "
                 "&& rm -rf /var/lib/apt/lists/*", user="root")
        .run_cmd(f"mkdir -p {APP} && chown -R user:user /home/user", user="root")
        .set_workdir(APP)
        .copy(FILES, f"{APP}/", user="user")
        .copy("src", f"{APP}/src", user="user")
        .run_cmd("npm install --no-audit --no-fund", user="user")
        .run_cmd("git init -q -b main && git config user.name Vivid "
                 "&& git config user.email builder@vivid "
                 "&& git add -A && git commit -q -m template", user="user")
        .set_start_cmd(f"bash {APP}/start.sh", wait_for_port(5173))
    )
    info = Template.build(template, name=NAME, cpu_count=2, memory_mb=2048,
                          on_build_logs=default_build_logger())
    print(f"built template {NAME}: {info}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
