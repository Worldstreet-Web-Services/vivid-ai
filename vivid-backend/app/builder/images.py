"""Pictures the builder makes when the user has none: product shots, hero
images, backgrounds. Rendered by the image model behind the media gateway,
stored like an upload (R2 plus public/uploads/<name> in the app), so they
persist in snapshots, appear in the asset list, and publish with the site.

Logos are deliberately not the main use: a typographic wordmark set in the
heading font renders sharp at every size, where an AI logo mark rarely
survives inspection. The skill says so; this tool still allows one when a
user asks for a mark.
"""
import asyncio
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
#: The apps are built for Nigerian businesses: any person in a picture is
#: Black African unless the prompt says otherwise, and marks are premium.
PEOPLE = "Any people shown are Black African (Nigerian), natural and confident."
STYLES = {
    "photo": ("Photorealistic product photography, soft studio light, clean uncluttered "
              f"background, sharp focus, no text, no watermark, no logo. {PEOPLE}"),
    "lifestyle": ("Editorial lifestyle photograph, natural directional light, shallow depth "
                  f"of field, cinematic, premium brand campaign, no text, no watermark. {PEOPLE}"),
    "logo": ("Modern app-icon style logo mark: one bold simple symbol, vibrant two-colour "
             "gradient with a subtle highlight, smooth rounded geometry, centered on a plain "
             "solid background, high contrast, no text, no letters, no words, no photo."),
    "illustration": ("Clean modern flat illustration with soft gradients and rounded shapes, "
                     f"limited palette, no text, no watermark. {PEOPLE}"),
}


#: Longest side of a stored picture; the model returns 1024 and pages
#: never show more than that.
MAX_SIDE = 1280
JPEG_QUALITY = 82


def compress(data: bytes, mime: str, kind: str) -> tuple[bytes, str]:
    """A megabyte PNG per picture makes a catalogue page crawl on a phone.
    Photos become JPEG at a quality nobody can tell from the original;
    logos stay PNG (a flat mark compresses well and keeps its edges) but
    are capped in size. Anything Pillow cannot read is stored as it came."""
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:                                      # not an image we know
        return data, mime
    if max(img.size) > MAX_SIDE:
        img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    if kind == "logo":
        img.save(out, format="PNG", optimize=True)
        return out.getvalue(), "image/png"
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue(), "image/jpeg"


FAVICON_LINK = '<link rel="icon" type="image/png" href="/favicon.png" />'
APPLE_LINK = '<link rel="apple-touch-icon" href="/favicon.png" />'


def favicon_bytes(logo_png: bytes, size: int = 256) -> bytes | None:
    """The logo mark at favicon size; None when Pillow cannot read it."""
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(logo_png)); img.load()
        img.thumbnail((size, size))
        out = io.BytesIO(); img.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception:
        return None


def with_favicon_links(html: str) -> str:
    """index.html with the favicon links, added once, before </head>."""
    if 'rel="icon"' in html or "rel='icon'" in html:
        return html
    tag = f"    {FAVICON_LINK}\n    {APPLE_LINK}\n"
    if "</head>" in html:
        return html.replace("</head>", tag + "  </head>", 1)
    return tag + html


#: Formats a replacement can be written back as, by the mime of the
#: picture it replaces. The extension must not change: the app's code
#: points at a path, and a content edit never edits code.
_PIL_FORMAT = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def refit(data: bytes, mime: str, width: int | None = None,
          height: int | None = None) -> tuple[bytes, str]:
    """A replacement picture shaped like the one it replaces: centre-cropped
    to the same aspect ratio, resized to the same box, written in the same
    format. A portrait photo dropped onto a wide hero therefore fills the
    hero instead of breaking the layout. Falls back to plain compression
    when the old size is unknown, and returns the bytes untouched when
    Pillow cannot read them (an SVG, say)."""
    fmt = _PIL_FORMAT.get(mime)
    if fmt is None:
        return data, mime
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:
        return data, mime
    if width and height and width > 0 and height > 0:
        target = width / height
        w, h = img.size
        if abs((w / h) - target) > 0.01:            # crop to the old ratio
            if (w / h) > target:
                new_w = int(round(h * target))
                left = (w - new_w) // 2
                img = img.crop((left, 0, left + new_w, h))
            else:
                new_h = int(round(w / target))
                top = (h - new_h) // 2
                img = img.crop((0, top, w, top + new_h))
        img = img.resize((min(width, MAX_SIDE), max(1, int(round(min(width, MAX_SIDE) / target)))),
                         Image.LANCZOS)
    elif max(img.size) > MAX_SIDE:
        img.thumbnail((MAX_SIDE, MAX_SIDE))
    if fmt in ("JPEG",) and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    out = io.BytesIO()
    if fmt == "PNG":
        img.save(out, format="PNG", optimize=True)
    elif fmt == "WEBP":
        img.save(out, format="WEBP", quality=JPEG_QUALITY, method=4)
    else:
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue(), mime


#: Pictures the editor can reshape and write back in place.
REFITTABLE = frozenset(_PIL_FORMAT)


def dimensions(data: bytes) -> dict:
    """{"width", "height"} for a picture, or {} when it cannot be read."""
    try:
        from PIL import Image
        import io
        with Image.open(io.BytesIO(data)) as img:
            return {"width": img.width, "height": img.height}
    except Exception:
        return {}


def ratio_for(width: int | None, height: int | None) -> str:
    """The named aspect closest to a picture's own shape."""
    if not width or not height:
        return "1:1"
    r = width / height
    return min(ASPECTS.values(), key=lambda name: abs(r - _RATIO_VALUE[name]))


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

    async def _favicon(self, logo_png: bytes) -> None:
        """Every site gets a favicon: the mark at 256px as public/favicon.png
        and the links in index.html. Never fails the picture."""
        icon = favicon_bytes(logo_png)
        if icon is None:
            return
        try:
            await self.sandbox.write_bytes("public/favicon.png", icon)
            try:
                html = await self.sandbox.read_file("index.html")
            except FileNotFoundError:
                return
            fixed = with_favicon_links(html)
            if fixed != html:
                await self.sandbox.write_file("index.html", fixed)
        except SandboxError as e:
            log.warning("favicon not written: %s", e)

    async def make(self, prompt: str, name: str, aspect: str = "square",
                   kind: str = "photo") -> dict:
        if self.left <= 0:
            have = ", ".join(p for p in self.made if p) or "none yet"
            raise ImageError(f"you have made {len(self.made)} images this turn, the most "
                             f"allowed; reuse these existing paths instead of inventing new "
                             f"ones: {have}")
        # Calls in one step run concurrently: hold the slot now, give it
        # back if the picture never lands.
        self.made.append(None)
        ratio = "1:1" if kind == "logo" else ASPECTS.get(aspect, "1:1")
        styled = f"{prompt.strip()}. {STYLES.get(kind, STYLES['photo'])}"
        try:
            data, mime = await media.generate_image(styled, aspect_ratio=ratio)
        except media.MediaRejected as e:
            self.made.remove(None)
            raise ImageError(f"the image model refused that prompt: {e.public}")
        except media.MediaUnavailable as e:
            self.made.remove(None)
            raise ImageError(f"the image model is unavailable right now ({e.public})")
        data, mime = compress(data, mime, kind)
        filename = name if "." in name else f"{name}.{'jpg' if 'jpeg' in mime else 'png'}"
        async with async_session() as db:
            asset = await assets.add(db, self.project_id, filename, mime, data)
            db.add(BuilderUsageEvent(project_id=self.project_id, kind="model", quantity=1,
                                     unit="images", model=settings.OPENROUTER_IMAGE_MODEL,
                                     meta={"stage": "image", "name": asset.name}))
            await db.commit()
            path, sb_path, meta = assets.public_path(asset), assets.sandbox_path(asset), asset.meta
        # A megabyte into the sandbox times out now and then; the picture is
        # already in storage, so a second try is cheap and usually enough.
        last: SandboxError | None = None
        for attempt in range(3):
            try:
                await self.sandbox.write_bytes(sb_path, data)
                last = None
                break
            except SandboxError as e:
                last = e
                await asyncio.sleep(1.5 * (attempt + 1))
        if last is not None:
            self.made.remove(None)
            raise ImageError(f"the image was made but could not be written to the app: {last}")
        self.made.remove(None)
        self.made.append(path)
        if kind == "logo":
            await self._favicon(data)
        return {"path": path, "bytes": len(data), "meta": meta or {}}


def available() -> bool:
    return media.image_available()


#: The numeric value of each named aspect, for picking the closest one.
_RATIO_VALUE = {"1:1": 1.0, "4:3": 4 / 3, "16:9": 16 / 9, "3:4": 3 / 4}


async def render(prompt: str, kind: str = "photo", ratio: str = "1:1") -> tuple[bytes, str]:
    """One picture from the image model with the house style applied, for
    the routes that make a picture outside a turn (replacing one on a built
    site). Raises ImageError with a sentence for the user."""
    styled = f"{prompt.strip()}. {STYLES.get(kind, STYLES['photo'])}"
    try:
        return await media.generate_image(styled, aspect_ratio=ratio)
    except media.MediaRejected as e:
        raise ImageError(f"the image model refused that description: {e.public}")
    except media.MediaUnavailable as e:
        raise ImageError(f"the image model is unavailable right now ({e.public})")
