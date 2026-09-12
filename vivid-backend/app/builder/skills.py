"""Skills: packaged expertise the orchestrator attaches to a turn.

A skill is a folder under BUILDER_SKILLS_DIR with a SKILL.md (frontmatter
plus the method) and optional references/. Nobody picks a skill; the loader
chooses by project state and stage: the design skill for turns that touch
UI, one page recipe matched to the spec, and the palette and font tables so
choices are curated rather than invented. Loaded once and cached; the text
changes only with a deploy, which keeps the prompt cacheable upstream.
"""
import logging
import re
from functools import lru_cache
from pathlib import Path

from app.core.config import settings

log = logging.getLogger("vivid.builder.skills")

#: Which recipe a project wants, by words in its spec and first request.
_RECIPE_WORDS = {
    "shop": ("shop", "store", "ecommerce", "e-commerce", "sell", "products", "cart",
             "checkout", "sneaker", "boutique", "catalog", "catalogue"),
    "booking": ("booking", "appointment", "reserve", "reservation", "salon", "barber",
                "clinic", "schedule", "slot", "class", "spa"),
    "dashboard": ("dashboard", "admin", "internal tool", "inventory", "crm", "manage",
                  "tracker", "analytics", "expense"),
    "portfolio": ("portfolio", "photographer", "my work", "showcase", "gallery",
                  "designer", "artist", "creator"),
    "landing": ("landing", "bakery", "restaurant", "cafe", "agency", "one page",
                "one-page", "brochure", "menu", "launch"),
}


def _strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            return text[end + 4:].lstrip()
    return text


def _root() -> Path:
    return Path(settings.BUILDER_SKILLS_DIR)


@lru_cache(maxsize=32)
def _read(rel: str) -> str:
    path = _root() / rel
    try:
        return _strip_frontmatter(path.read_text(encoding="utf-8")).strip()
    except OSError:
        log.warning("skill file missing: %s", path)
        return ""


def clear_cache() -> None:
    _read.cache_clear()


def recipe_for(text: str) -> str | None:
    """The recipe whose words appear most in the spec and request."""
    low = (text or "").lower()
    scores = {name: sum(low.count(w) for w in words) for name, words in _RECIPE_WORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None


def design_block(spec_md: str | None, user_text: str = "") -> str:
    """The design skill for a UI turn: method, palettes, fonts, one recipe."""
    if not settings.BUILDER_DESIGN_SKILL:
        return ""
    parts = [_read("design/SKILL.md")]
    if not parts[0]:
        return ""
    recipe = recipe_for(f"{spec_md or ''}\n{user_text}")
    if recipe:
        text = _read(f"design/references/recipes/{recipe}.md")
        if text:
            parts.append(text)
    for ref in ("design/references/palettes.md", "design/references/fonts.md"):
        text = _read(ref)
        if text:
            parts.append(text)
    block = "\n\n".join(p for p in parts if p)
    return "## Design skill\n" + block


def copy_block() -> str:
    """The copy skill for any turn that writes visible text."""
    if not settings.BUILDER_COPY_SKILL:
        return ""
    text = _read("copy/SKILL.md")
    return "## Copy skill\n" + text if text else ""


def ui_block(spec_md: str | None, user_text: str = "") -> str:
    """Everything a UI turn gets: the design skill with its recipe, then the
    copy skill. Order matters little to the model; the design skill is
    first because the recipe names the sections the copy then fills."""
    return "\n\n".join(b for b in (design_block(spec_md, user_text), copy_block()) if b)


def available() -> list[str]:
    root = _root()
    if not root.is_dir():
        return []
    return sorted(p.parent.name for p in root.glob("*/SKILL.md"))
