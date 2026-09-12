"""Pictures the builder makes when the user has none: product shots, hero
images, backgrounds. Rendered by the image model behind the media gateway,
stored like an upload (R2 plus public/uploads/<name> in the app), so they
persist in snapshots, appear in the asset list, and publish with the site.

Logos are deliberately not the main use: a typographic wordmark set in the
heading font renders sharp at every size, where an AI logo mark rarely
survives inspection. The skill says so; this tool still allows one when a
user asks for a mark.
"""
import logging
from dataclasses import dataclass, field

from app.builder import assets
from app.builder.sandbox.base import Sandbox, SandboxError
from app.core.config import settings
from app.db.models import BuilderUsageEvent
from app.db.session import async_session
from app.services.models_gateway import media

log = logging.getLogger("vivid.builder.images")

ASPECTS = {"square": "1:1", "landscape": "4:3", "wide": "16:9", "portrait": "3:4"}


class ImageError(Exception):
    """For the model to read: what went wrong, without a vendor name."""


@dataclass
class ImageMaker:
    """Per turn: the project the pictures belong to and how many are left."""
    project_id: str
    sandbox: Sandbox
    made: list[str] = field(default_factory=list)

    @property
    def left(self) -> int:
        return settings.BUILDER_IMAGES_PER_TURN - len(self.made)

    async def make(self, prompt: str, name: str, aspect: str = "square") -> dict:
        if self.left <= 0:
            raise ImageError(f"you have made {len(self.made)} images this turn, the most "
                             "allowed; reuse them or continue next turn")
        ratio = ASPECTS.get(aspect, "1:1")
        styled = (f"{prompt.strip()}. Photorealistic product photography, soft studio light, "
                  "clean uncluttered background, sharp focus, no text, no watermark, no logo.")
        try:
            data, mime = await media.generate_image(styled, aspect_ratio=ratio)
        except media.MediaRejected as e:
            raise ImageError(f"the image model refused that prompt: {e.public}")
        except media.MediaUnavailable as e:
            raise ImageError(f"the image model is unavailable right now ({e.public})")
        filename = name if "." in name else f"{name}.{'jpg' if 'jpeg' in mime else 'png'}"
        async with async_session() as db:
            asset = await assets.add(db, self.project_id, filename, mime, data)
            db.add(BuilderUsageEvent(project_id=self.project_id, kind="model", quantity=1,
                                     unit="images", model=settings.OPENROUTER_IMAGE_MODEL,
                                     meta={"stage": "image", "name": asset.name}))
            await db.commit()
            path, sb_path, meta = assets.public_path(asset), assets.sandbox_path(asset), asset.meta
        try:
            await self.sandbox.write_bytes(sb_path, data)
        except SandboxError as e:
            raise ImageError(f"the image was made but could not be written to the app: {e}")
        self.made.append(path)
        return {"path": path, "bytes": len(data), "meta": meta or {}}


def available() -> bool:
    return media.image_available()
