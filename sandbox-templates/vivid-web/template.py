"""Build (or rebuild) the `vivid-web` E2B template.

    E2B_API_KEY=... python template.py

Everything the sandbox needs is in this directory: the Vite project, the
Dockerfile that installs it under /home/user/app, and start.sh, which the
sandbox runs on boot. The template is ready when :5173 answers.

Rebuild after changing package.json or any template file; running sandboxes
keep the old image, new ones get the new one.
"""
import os
import sys
from pathlib import Path

from e2b import Template, default_build_logger, wait_for_port

HERE = Path(__file__).resolve().parent
NAME = os.environ.get("E2B_TEMPLATE", "vivid-web")


def main() -> int:
    if not os.environ.get("E2B_API_KEY"):
        print("E2B_API_KEY is not set", file=sys.stderr)
        return 2
    os.chdir(HERE)
    template = (
        Template()
        .from_dockerfile("e2b.Dockerfile")
        .set_workdir("/home/user/app")
        .set_start_cmd("bash /home/user/app/start.sh", wait_for_port(5173))
    )
    info = Template.build(template, name=NAME, cpu_count=2, memory_mb=2048,
                          on_build_logs=default_build_logger())
    print(f"built template {NAME}: {info}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
