"""Editing a built site's content without the model.

A content change is not a code change. Swapping a photo or fixing a
headline should cost no model tokens, take a second, and carry no risk of
the app coming back subtly different. Two mechanisms, both without the
model:

- Pictures: the bytes at public/uploads/<name> are replaced and the source
  is not touched at all, so nothing can break (assets.py and the route).
- Text: the sandbox's dev build stamps every JSX element with its source
  location (a Babel plugin in the template's Vite config), so a click in
  the preview names one exact span. This module replaces that span, and
  nothing else in the file moves.

The rule that keeps quality: anything that is not a plain literal is
refused with a reason the user can act on ("this text comes from the app's
data"), and the client sends those to the chat instead of guessing. The
route applies a batch all-or-nothing and typechecks before it commits, so
a bad edit never reaches the preview.
"""
import logging
import re
from dataclasses import dataclass, field

log = logging.getLogger("vivid.builder.content")

#: file.tsx:line:column, as the Babel plugin writes it. Line is 1-based,
#: column 0-based, which is what Babel reports.
LOC = re.compile(r"^(?P<path>[\w./-]+\.tsx?):(?P<line>\d+):(?P<col>\d+)$")
MAX_TEXT = 5000
MAX_ATTR = 1000
#: Attributes the editor may change. `src` is here for completeness, but
#: replacing the file at the same path is the better path for pictures.
EDITABLE_ATTRS = {"alt", "title", "placeholder", "aria-label", "href", "src", "value"}


class ContentError(Exception):
    """Refused, with a sentence for the user. Never a stack trace."""


@dataclass
class Edit:
    """One change: the element at `loc`, and what to make of it."""
    loc: str
    value: str
    kind: str = "text"                    # text | attr
    attr: str | None = None
    #: What the client saw. When given and the file no longer says that,
    #: the edit is refused rather than overwriting someone else's change.
    expect: str | None = None

    @property
    def path(self) -> str:
        return _parse(self.loc)[0]


@dataclass
class FileEdits:
    path: str
    edits: list[Edit] = field(default_factory=list)


def normalise(text: str) -> str:
    """JSX text as the browser renders it: runs of whitespace collapse."""
    return " ".join((text or "").split())


def _parse(loc: str) -> tuple[str, int, int]:
    m = LOC.match((loc or "").strip())
    if not m:
        raise ContentError("that element's location is not one this editor understands")
    path = m.group("path")
    if path.startswith("/") or ".." in path:
        raise ContentError("that location is outside the project")
    return path, int(m.group("line")), int(m.group("col"))


def _offset(src: str, line: int, col: int) -> int:
    lines = src.split("\n")
    if line < 1 or line > len(lines):
        raise ContentError("that element is no longer where the editor saw it")
    return sum(len(l) + 1 for l in lines[:line - 1]) + col


def _element_start(src: str, offset: int) -> int:
    """The '<' of the element at the offset. Exact or nothing: the location
    came from this same file, so anything else means the file moved under
    the editor, and guessing at a neighbour is how a visual edit ruins a
    page."""
    if 0 <= offset < len(src) and src[offset] == "<":
        return offset
    raise ContentError("that element has moved; reload the preview and try again")


def _opening_tag(src: str, start: int) -> tuple[int, bool]:
    """Index of the '>' closing the opening tag, and whether the element is
    self-closing. Quoted strings and {expressions} are stepped over, so a
    '>' inside either does not end the tag."""
    i, depth, quote = start + 1, 0, ""
    while i < len(src):
        c = src[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = ""
        elif c in "\"'`":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == ">" and depth == 0:
            return i, src[i - 1] == "/"
        i += 1
    raise ContentError("that element could not be read")


def escape_text(value: str) -> str:
    """A value safe to drop into JSX text. Braces would open an expression
    and angle brackets an element, so both become entities, which React
    renders as the characters the user typed."""
    if "\n" in value:
        value = " ".join(value.split("\n"))
    return (value.replace("{", "&#123;").replace("}", "&#125;")
                 .replace("<", "&lt;").replace(">", "&gt;"))


def escape_attr(value: str) -> str:
    return (value.replace("&", "&amp;").replace('"', "&quot;")
                 .replace("<", "&lt;").replace(">", "&gt;"))


def apply_text(src: str, edit: Edit) -> str:
    """The element's text child replaced, its surrounding whitespace kept
    so the file's formatting does not move."""
    if len(edit.value) > MAX_TEXT:
        raise ContentError("that text is too long for one element")
    path, line, col = _parse(edit.loc)
    start = _element_start(src, _offset(src, line, col))
    gt, self_closing = _opening_tag(src, start)
    if self_closing:
        raise ContentError("that element has no text of its own")
    nxt = src.find("<", gt + 1)
    if nxt == -1:
        raise ContentError("that element could not be read")
    raw = src[gt + 1:nxt]
    if "{" in raw or "}" in raw:
        raise ContentError("that text comes from the app's data, so it needs a prompt to change")
    if not raw.strip():
        raise ContentError("that element holds other elements, not text; click the words themselves")
    if edit.expect is not None and normalise(edit.expect) != normalise(raw):
        raise ContentError("that text changed since the editor read it; reload the preview")
    lead = raw[:len(raw) - len(raw.lstrip())]
    trail = raw[len(raw.rstrip()):]
    return src[:gt + 1] + lead + escape_text(edit.value.strip()) + trail + src[nxt:]


def apply_attr(src: str, edit: Edit) -> str:
    """One attribute's string value replaced, or the attribute added when
    the element does not carry it yet."""
    attr = (edit.attr or "").strip()
    if attr not in EDITABLE_ATTRS:
        raise ContentError(f"{attr or 'that attribute'} is not one the editor may change")
    if len(edit.value) > MAX_ATTR:
        raise ContentError("that value is too long")
    path, line, col = _parse(edit.loc)
    start = _element_start(src, _offset(src, line, col))
    gt, self_closing = _opening_tag(src, start)
    tag = src[start:gt]
    m = re.search(r"(?<![\w:-])" + re.escape(attr) + r"\s*=\s*", tag)
    if m is None:
        if edit.expect:
            raise ContentError("that value changed since the editor read it; reload the preview")
        insert = gt - 1 if self_closing else gt
        before = src[:insert].rstrip()
        written = f' {attr}="{escape_attr(edit.value)}"'
        return before + written + (" " if self_closing else "") + src[insert:]
    value_at = start + m.end()
    opener = src[value_at] if value_at < len(src) else ""
    if opener == "{":
        raise ContentError(f"that {attr} comes from the app's data, so it needs a prompt to change")
    if opener not in ('"', "'"):
        raise ContentError(f"that {attr} could not be read")
    end = src.find(opener, value_at + 1)
    if end == -1 or end > gt:
        raise ContentError(f"that {attr} could not be read")
    current = src[value_at + 1:end]
    if edit.expect is not None and normalise(edit.expect) != normalise(current):
        raise ContentError(f"that {attr} changed since the editor read it; reload the preview")
    return src[:value_at + 1] + escape_attr(edit.value) + src[end:]


def apply_one(src: str, edit: Edit) -> str:
    if edit.kind == "attr":
        return apply_attr(src, edit)
    if edit.kind == "text":
        return apply_text(src, edit)
    raise ContentError(f"{edit.kind} is not something the editor can change")


def group(edits: list[Edit]) -> list[FileEdits]:
    """Edits by file, each file's edits ordered from the end of the file
    backwards, so applying one does not move the next one's offsets."""
    by_path: dict[str, list[Edit]] = {}
    for e in edits:
        by_path.setdefault(e.path, []).append(e)
    out = []
    for path, group_edits in by_path.items():
        group_edits.sort(key=lambda e: (_parse(e.loc)[1], _parse(e.loc)[2]), reverse=True)
        out.append(FileEdits(path=path, edits=group_edits))
    return out


def apply_to_file(src: str, edits: list[Edit]) -> str:
    for edit in edits:
        src = apply_one(src, edit)
    return src
