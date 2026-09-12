"""Pictures of the page the builder just made, for the model to look at.

The sandbox template carries Chromium and scripts/screenshot.mjs; running it
against the dev server yields a desktop and a phone JPEG. They go to the
blob store (so a client can show them, and the eval can keep them) and to
the model as data URLs. Nothing here is a tool the model calls; the loop
decides when to look.
"""
import base64
import logging
from dataclasses import dataclass

from app.builder import blob
from app.builder.sandbox.base import Sandbox, SandboxError
from app.core.config import settings

log = logging.getLogger("vivid.builder.screenshots")

SHOTS = (("desktop", 1280), ("mobile", 390))


@dataclass
class Shot:
    name: str
    width: int
    data: bytes
    key: str | None = None

    @property
    def data_url(self) -> str:
        return "data:image/jpeg;base64," + base64.b64encode(self.data).decode()

    @property
    def url(self) -> str | None:
        return blob.presigned_url(self.key, expires_in=7 * 24 * 3600) if self.key else None


async def capture(sandbox: Sandbox, project_id: str, label: str,
                  store: bool = True) -> list[Shot]:
    """Both shots, or an empty list when the sandbox cannot take them (no
    Chromium on this template, the page not answering). Never raises: a
    missing critique is not a failed turn."""
    out_dir = f"/tmp/vivid-shots-{sandbox.id}"
    result = await sandbox.run(
        f"rm -rf {out_dir} && node scripts/screenshot.mjs http://localhost:{settings.BUILDER_DEV_PORT} {out_dir}",
        timeout=settings.BUILDER_SCREENSHOT_TIMEOUT)
    if not result.ok:
        log.warning("screenshot failed for %s: %s", project_id, result.output[-300:])
        return []
    shots: list[Shot] = []
    for name, width in SHOTS:
        try:
            data = await sandbox.read_bytes(f"{out_dir}/{name}.jpg")
        except (FileNotFoundError, SandboxError) as e:
            log.warning("screenshot %s missing for %s: %s", name, project_id, e)
            continue
        shot = Shot(name=name, width=width, data=data)
        if store:
            key = f"{settings.R2_PREFIX}projects/{project_id}/shots/{label}-{name}.jpg"
            try:
                await blob.put(key, data, "image/jpeg")
                shot.key = key
            except blob.BlobError as e:
                log.warning("screenshot not stored: %s", e)
        shots.append(shot)
    await sandbox.run(f"rm -rf {out_dir}", timeout=15)
    return shots


CRITIQUE_BRIEF = """Here is your page as a user sees it: first at 1280px (desktop), then at \
390px (a phone). Look at both carefully.

List the problems you can see, most important first, at most five: text or elements \
overflowing or clipped on the phone, wrong hierarchy (what should read first does not), \
uneven spacing, misaligned edges, images without a fixed aspect ratio or stretched, low \
contrast, an empty-looking or unbalanced section, a hero without a visible action on the \
phone, anything that still says placeholder. Then fix them with edit_file. If the page is \
genuinely good on both screens, say so in one line and do not change anything.

Reply to the user afterwards in one or two sentences about what you adjusted."""


def critique_message(shots: list[Shot]) -> dict:
    """The user-role message that shows the model its own page."""
    parts: list[dict] = [{"type": "text", "text": CRITIQUE_BRIEF}]
    for shot in shots:
        parts.append({"type": "text", "text": f"[{shot.name}, {shot.width}px wide]"})
        parts.append({"type": "image_url", "image_url": {"url": shot.data_url}})
    return {"role": "user", "content": parts}
