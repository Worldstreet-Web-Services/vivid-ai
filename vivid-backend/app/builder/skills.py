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


_TITLE = re.compile(r"^#\s*Recipe:\s*(.+)$", re.M)


def recipes() -> list[dict]:
    """The page recipes on disk, name and title, so the planner can offer
    exactly what exists: dropping a file in the folder adds a recipe."""
    folder = _root() / "design" / "references" / "recipes"
    out = []
    for path in sorted(folder.glob("*.md")):
        text = _read(f"design/references/recipes/{path.name}")
        m = _TITLE.search(text)
        out.append({"name": path.stem, "title": (m.group(1).strip() if m else path.stem)})
    return out


def recipe_names() -> list[str]:
    return [r["name"] for r in recipes()]


def recipe_menu() -> str:
    """One line per recipe for a prompt."""
    return "\n".join(f"- {r['name']}: {r['title']}" for r in recipes())


async def pick_recipe(text: str) -> str | None:
    """Ask the planning model which recipe fits a project that skipped plan
    mode. One short call; the answer is stored on the project so it runs
    once. Returns None when nothing fits or the call fails."""
    names = recipe_names()
    if not names or not (text or "").strip():
        return None
    from app.builder import routing
    from app.services.models_gateway import code_llm
    prompt = ("Which page recipe fits this app best? Answer with the recipe name only, "
              f"or 'none'.\n\nRecipes:\n{recipe_menu()}\n\nApp:\n{text[:2000]}")
    try:
        out = []
        async for ev in code_llm.stream_chat([{"role": "user", "content": prompt}], [],
                                             endpoint=routing.endpoint_for(routing.PLAN),
                                             max_tokens=20, temperature=0):
            if ev.get("type") == "token":
                out.append(ev["text"])
        answer = "".join(out).strip().lower().strip(".'\"`")
    except Exception as e:                                 # a missing recipe is not a failed turn
        log.warning("recipe pick failed: %s", e)
        return None
    return answer if answer in names else None


def design_block(spec_md: str | None, user_text: str = "", recipe: str | None = None) -> str:
    """The design skill for a UI turn: method, palettes, fonts, and the
    recipe the plan chose (or pick_recipe stored) for this project."""
    if not settings.BUILDER_DESIGN_SKILL:
        return ""
    parts = [_read("design/SKILL.md")]
    if not parts[0]:
        return ""
    if recipe and recipe in recipe_names():
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


def payments_block(provider: str | None) -> str:
    """The payments skill, when the project takes payments."""
    if not provider or provider == "none":
        return ""
    text = _read(f"payments/SKILL.md")
    return "## Payments skill\n" + text if text else ""


def fullstack_block(backend: bool) -> str:
    """The app-logic skill, when the project has a Supabase backend: accounts,
    roles and policies, data, lifecycles, edge functions, and the patterns
    (SQL and TypeScript) to copy so every project has the same shape."""
    if not backend or not settings.BUILDER_FULLSTACK_SKILL:
        return ""
    text = _read("fullstack/SKILL.md")
    if not text:
        return ""
    patterns = _read("fullstack/references/patterns.md")
    block = text + ("\n\n" + patterns if patterns else "")
    return "## App logic skill\n" + block


def ui_block(spec_md: str | None, user_text: str = "",
             payments: str | None = None, backend: bool = False,
             recipe: str | None = None) -> str:
    """Everything a build or edit turn gets: the design skill with its
    recipe, the copy skill, the app-logic skill when a backend is linked,
    and the payments skill when payments are enabled. The design skill is
    first because the recipe names the sections the copy fills; app logic
    comes before payments because the payments flow builds on its orders."""
    blocks = (design_block(spec_md, user_text, recipe), copy_block(),
              fullstack_block(backend), payments_block(payments))
    return "\n\n".join(b for b in blocks if b)


def available() -> list[str]:
    root = _root()
    if not root.is_dir():
        return []
    return sorted(p.parent.name for p in root.glob("*/SKILL.md"))
