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

#: What gets added to the model's prompt per kind. Photos are the default.
#: A logo is a flat mark with no text: the brand name is set in type next to
#: it, which stays sharp; the mark gives the wordmark a face.
STYLES = {
    "photo": ("Photorealistic product photography, soft studio light, clean uncluttered "
              "background, sharp focus, no text, no watermark, no logo."),
    "lifestyle": ("Editorial lifestyle photograph, dramatic directional light, shallow depth "
                  "of field, dark moody background, cinematic, no text, no watermark."),
    "logo": ("Flat vector-style logo mark, a single simple geometric symbol, bold clean "
             "shapes, one or two colours, centered on a plain solid background, no text, "
             "no letters, no words, no gradients, no photo."),
    "illustration": ("Clean flat illustration, simple shapes, limited palette, no text, "
                     "no watermark."),
}


class ImageError(Exception):
    """For the model to read: what went wrong, without a vendor name."""


@dataclass
class ImageMaker:
    """Per turn: the project the pictures belong to and how many are left."""
    project_id: str
    sandbox: Sandbox
    made: list[str] = field(default_factory=list)
    #: None = the per-turn setting; a first build passes the larger cap.
    limit: int | None = None

    @property
    def left(self) -> int:
        cap = self.limit if self.limit is not None else settings.BUILDER_IMAGES_PER_TURN
        return cap - len(self.made)

    async def make(self, prompt: str, name: str, aspect: str = "square",
                   kind: str = "photo") -> dict:
        if self.left <= 0:
            raise ImageError(f"you have made {len(self.made)} images this turn, the most "
                             "allowed; reuse them or continue next turn")
        ratio = "1:1" if kind == "logo" else ASPECTS.get(aspect, "1:1")
        styled = f"{prompt.strip()}. {STYLES.get(kind, STYLES['photo'])}"
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
