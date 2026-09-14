"""Editing a built site without the model: the source patcher, the preview
hooks that make a click mean one span, and the routes that apply an edit
or swap a picture."""
import io

import pytest
from PIL import Image

from app.builder import content, editor, images
from tests.builder_fakes import FakeSandbox

SRC = '''export function Card({ title, ...props }) {
  return (
    <div className="card" {...props}>
      <h3>{title}</h3>
      <p>Order now</p>
      <img src="/uploads/hero.jpg" alt="A hero" />
      <Button size="lg">Add to bag</Button>
    </div>
  );
}
'''
F = "src/components/Card.tsx"


def edit(loc, value, **kw):
    return content.Edit(loc=loc, value=value, **kw)


def line(src, needle):
    return next(l.strip() for l in src.split("\n") if needle in l)


def test_text_is_replaced_in_place():
    out = content.apply_one(SRC, edit(f"{F}:5:6", "Order yours today"))
    assert line(out, "<p>") == "<p>Order yours today</p>"
    assert out.count("\n") == SRC.count("\n")               # formatting untouched
    assert line(out, "<Button") == '<Button size="lg">Add to bag</Button>'


def test_a_components_text_is_edited_at_its_call_site():
    """A shadcn button spreads {...props}, so the DOM element carries the
    call site's location, and that is where the words live."""
    out = content.apply_one(SRC, edit(f"{F}:7:6", "Add to cart"))
    assert line(out, "<Button") == '<Button size="lg">Add to cart</Button>'


def test_what_the_editor_refuses():
    for loc, value, reason in [
        (f"{F}:4:6", "Nope", "comes from the app's data"),       # {title}
        (f"{F}:3:4", "Nope", "holds other elements"),            # a wrapper
        (f"{F}:6:6", "Nope", "no text of its own"),              # self-closing
        (f"{F}:9:6", "Nope", "has moved"),                       # nothing there
        (f"{F}:5:7", "Nope", "has moved"),                       # off by one column
        ("src/../etc/passwd.tsx:1:0", "Nope", "outside the project"),
        ("not-a-location", "Nope", "not one this editor understands"),
    ]:
        with pytest.raises(content.ContentError) as e:
            content.apply_one(SRC, edit(loc, value))
        assert reason in str(e.value), loc
    with pytest.raises(content.ContentError) as e:
        content.apply_one(SRC, edit(f"{F}:5:6", "x" * (content.MAX_TEXT + 1)))
    assert "too long" in str(e.value)


def test_expect_guards_against_a_stale_editor():
    with pytest.raises(content.ContentError) as e:
        content.apply_one(SRC, edit(f"{F}:5:6", "x", expect="Buy it"))
    assert "changed since" in str(e.value)
    # Whitespace is compared the way the browser renders it.
    out = content.apply_one(SRC, edit(f"{F}:5:6", "Done", expect="  Order   now "))
    assert line(out, "<p>") == "<p>Done</p>"


def test_braces_and_angles_cannot_escape_into_code():
    out = content.apply_one(SRC, edit(f"{F}:5:6", "Save {50}% <today>"))
    assert line(out, "<p>") == "<p>Save &#123;50&#125;% &lt;today&gt;</p>"
    assert "{50}" not in out


def test_attributes_are_replaced_added_and_guarded():
    out = content.apply_one(SRC, edit(f"{F}:6:6", 'A "hero" shot', kind="attr", attr="alt"))
    assert line(out, "<img") == '<img src="/uploads/hero.jpg" alt="A &quot;hero&quot; shot" />'
    out = content.apply_one(SRC, edit(f"{F}:6:6", "Our hero", kind="attr", attr="title"))
    assert line(out, "<img") == '<img src="/uploads/hero.jpg" alt="A hero" title="Our hero" />'
    out = content.apply_one(SRC, edit(f"{F}:5:6", "Buy", kind="attr", attr="title"))
    assert line(out, "<p") == '<p title="Buy">Order now</p>'
    with pytest.raises(content.ContentError) as e:
        content.apply_one(SRC, edit(f"{F}:5:6", "x", kind="attr", attr="className"))
    assert "not one the editor may change" in str(e.value)
    dynamic = SRC.replace('src="/uploads/hero.jpg"', "src={photo}")
    with pytest.raises(content.ContentError) as e:
        content.apply_one(dynamic, edit(f"{F}:6:6", "/uploads/new.jpg", kind="attr", attr="src"))
    assert "comes from the app's data" in str(e.value)


def test_several_edits_in_one_file_do_not_move_each_other():
    out = content.apply_to_file(SRC, content.group(
        [edit(f"{F}:5:6", "One"), edit(f"{F}:7:6", "Two")])[0].edits)
    assert line(out, "<p>") == "<p>One</p>" and line(out, "<Button") == '<Button size="lg">Two</Button>'


def test_group_orders_files_and_edits():
    groups = content.group([edit(f"{F}:5:6", "a"), edit("src/App.tsx:2:0", "b"), edit(f"{F}:7:6", "c")])
    assert {g.path for g in groups} == {F, "src/App.tsx"}
    card = next(g for g in groups if g.path == F)
    assert [e.loc for e in card.edits] == [f"{F}:7:6", f"{F}:5:6"]      # last first


# ------------------------------------------------------------- preview hooks
CONFIG = '''import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
'''
INDEX = '<!doctype html>\n<html>\n  <head><title>x</title></head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n'


def test_the_config_is_patched_once_and_keeps_everything_else():
    out = editor.patch_config(CONFIG)
    assert "plugins: [vividSourceLocation(), react(), tailwindcss()]" in out
    assert "function vividSourceLocation" in out
    assert 'apply: "serve"' in out                             # never in a build
    assert "react/jsx-dev-runtime" in out                      # wraps the dev runtime
    assert "columnNumber - 1" in out                           # the runtime counts from one
    assert editor.patch_config(out) is None                    # idempotent
    assert editor.patch_config("export default {}") is None    # unexpected shape, left alone


def test_an_older_plugin_is_replaced_in_place():
    """A project patched by an earlier backend upgrades on its next start
    instead of keeping a plugin that no longer works."""
    current = editor.patch_config(CONFIG)
    stale = current.replace("columnNumber - 1", "columnNumber")
    out = editor.patch_config(stale)
    assert out is not None and "columnNumber - 1" in out
    assert out.count(editor.BLOCK_START) == 1 and "tailwindcss()" in out
    assert editor.patch_config(out) is None

    # The first shape was a Babel plugin the React plugin no longer runs:
    # its definition and its wiring are both replaced.
    legacy = CONFIG.replace("react()", editor.LEGACY_REACT_CALL).replace(
        "export default", "// Stamps each JSX element with its location.\nfunction vividSourceLocation() {\n  return { name: \"vivid-source-location\" };\n}\n\nexport default", 1)
    out = editor.patch_config(legacy)
    assert out is not None and out.count("function vividSourceLocation") == 1
    assert editor.LEGACY_REACT_CALL not in out and editor.WIRED in out
    assert editor.BLOCK_START in out and "react/jsx-dev-runtime" in out


def test_the_index_gets_the_editor_script_and_publish_takes_it_out():
    out = editor.patch_index(INDEX)
    assert editor.SCRIPT_START in out and "vivid:select" in out and out.rstrip().endswith("</html>")
    assert editor.patch_index(out) is None
    assert editor.strip_script(out) == INDEX          # the page is exactly as it was
    assert editor.strip_script(INDEX) == INDEX


def test_the_injected_plugin_carries_no_escapes():
    """Two layers of quoting once put a lone backslash in the config and
    stopped the dev server restarting; the plugin has none at all now."""
    assert "\\" not in editor.PLUGIN and "\\" not in editor.BLOCK


async def test_ensure_patches_a_sandbox_that_predates_the_editor():
    sb = FakeSandbox({"vite.config.ts": CONFIG, "index.html": INDEX})
    sb.config_ok = True
    assert await editor.ensure(sb) is True
    assert editor.MARKER in sb.files["vite.config.ts"] and editor.SCRIPT_START in sb.files["index.html"]
    before = dict(sb.files)
    assert await editor.ensure(sb) is True
    assert sb.files == before                                  # nothing rewritten the second time
    assert await editor.ensure(FakeSandbox({"index.html": INDEX})) is False


async def test_a_config_that_would_not_parse_is_never_written():
    """The check runs in the sandbox before the file moves, because a
    broken config takes the whole preview down."""
    sb = FakeSandbox({"vite.config.ts": CONFIG, "index.html": INDEX})
    sb.config_ok = False
    assert await editor.ensure(sb) is False
    assert sb.files["vite.config.ts"] == CONFIG                # put back byte for byte
    assert editor.SCRIPT_START in sb.files["index.html"]       # the page script is safe on its own


# ------------------------------------------------------------------ pictures
def jpeg(w, h, colour=(200, 30, 30)):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), colour).save(buf, format="JPEG")
    return buf.getvalue()


def test_a_replacement_picture_keeps_the_old_shape_and_format():
    out, mime = images.refit(jpeg(600, 900), "image/jpeg", 1024, 768)
    assert mime == "image/jpeg" and Image.open(io.BytesIO(out)).size == (1024, 768)
    assert images.dimensions(out) == {"width": 1024, "height": 768}
    png = io.BytesIO()
    Image.new("RGBA", (300, 300), (0, 0, 0, 0)).save(png, format="PNG")
    out, mime = images.refit(png.getvalue(), "image/png", 256, 256)
    assert mime == "image/png" and out[:4] == b"\x89PNG"
    assert images.refit(b"<svg/>", "image/svg+xml") == (b"<svg/>", "image/svg+xml")
    assert images.refit(b"not a picture", "image/jpeg") == (b"not a picture", "image/jpeg")
    assert images.ratio_for(1024, 768) == "4:3" and images.ratio_for(None, None) == "1:1"
