"""What the preview needs for visual editing.

Two small pieces live in the app itself: a Babel plugin that stamps every
JSX element with its source location while the dev server runs, and a
script in index.html that turns a click in the preview into a message
naming that location. Together they let the builder change the words on a
page without the model guessing which of four "Order now" buttons was
meant.

Both are in the sandbox template, so a fresh project has them. They are
also written into a project that predates them when its sandbox starts,
because a user should not have to rebuild a site to edit its text. The
config is patched surgically (the plugin is added to the existing
`react()` call) rather than overwritten, so nothing else in it is lost.

Neither piece reaches the published site: the plugin stops at
NODE_ENV=production, and publish strips the script.
"""
import logging
import re

from app.builder.sandbox.base import Sandbox, SandboxError

log = logging.getLogger("vivid.builder.editor")

MARKER = "vivid-source-location"
CONFIG = "vite.config.ts"
INDEX = "index.html"
SCRIPT_START = "<!-- vivid:editor -->"
SCRIPT_END = "<!-- /vivid:editor -->"

#: Added to the dev server's Babel run. It goes in as the first attribute
#: so that a component spreading {...props} onto its root passes the call
#: site's location down to the element the user actually clicks.
PLUGIN = '''
// Stamps each JSX element with "file:line:column" while the dev server is
// running, so the builder's visual editor can map a click in the preview
// back to one exact span of source. Never in a production build.
function vividSourceLocation({ types: t }) {
  return {
    name: "vivid-source-location",
    visitor: {
      JSXOpeningElement(path, state) {
        if (process.env.NODE_ENV === "production") return;
        const node = path.node;
        if (!node.loc) return;
        const file = String(state.filename || "");
        const root = String(state.cwd || "");
        const rel = file.startsWith(root) ? file.slice(root.length + 1) : file;
        if (!rel.startsWith("src/")) return;
        for (const attr of node.attributes) {
          if (attr.name && attr.name.name === "data-vivid-loc") return;
        }
        node.attributes.unshift(
          t.jsxAttribute(
            t.jsxIdentifier("data-vivid-loc"),
            t.stringLiteral(rel + ":" + node.loc.start.line + ":" + node.loc.start.column)
          )
        );
      },
    },
  };
}
'''.strip()

REACT_CALL = "react({ babel: { plugins: [vividSourceLocation] } })"

#: Turned on by the builder with postMessage({type:"vivid:editor",on:true}).
#: Until then it does nothing at all, so a published page is unaffected.
SCRIPT = f'''{SCRIPT_START}
    <script>
      (function () {{
        if (window.parent === window) return;
        var on = false, marked = null;
        function styleOnce() {{
          if (document.getElementById("vivid-edit-style")) return;
          var el = document.createElement("style");
          el.id = "vivid-edit-style";
          el.textContent = "[data-vivid-hover]{{outline:2px solid #0ea5e9!important;outline-offset:2px;cursor:pointer!important}}";
          document.head.appendChild(el);
        }}
        function anchor(el) {{
          while (el && el !== document.documentElement) {{
            if (el.getAttribute && el.getAttribute("data-vivid-loc")) return el;
            el = el.parentElement;
          }}
          return null;
        }}
        function mark(el) {{
          if (marked === el) return;
          if (marked) marked.removeAttribute("data-vivid-hover");
          marked = el;
          if (marked) marked.setAttribute("data-vivid-hover", "");
        }}
        function send(msg) {{ try {{ window.parent.postMessage(msg, "*"); }} catch (_) {{}} }}
        function describe(el) {{
          var r = el.getBoundingClientRect();
          var out = {{
            type: "vivid:select",
            loc: el.getAttribute("data-vivid-loc"),
            tag: el.tagName.toLowerCase(),
            simple: el.children.length === 0,
            rect: {{ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }}
          }};
          if (el.tagName === "IMG") {{
            out.kind = "image";
            out.src = el.getAttribute("src") || "";
            out.alt = el.getAttribute("alt") || "";
          }} else {{
            out.kind = "text";
            out.text = (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 2000);
          }}
          return out;
        }}
        document.addEventListener("mousemove", function (e) {{ if (on) mark(anchor(e.target)); }}, true);
        document.addEventListener("click", function (e) {{
          if (!on) return;
          e.preventDefault();
          e.stopPropagation();
          var el = anchor(e.target);
          if (el) send(describe(el));
        }}, true);
        window.addEventListener("message", function (e) {{
          var d = e.data || {{}};
          if (d.type !== "vivid:editor") return;
          on = !!d.on;
          styleOnce();
          if (!on) mark(null);
          send({{ type: "vivid:editor-state", on: on, ready: !!document.querySelector("[data-vivid-loc]") }});
        }});
      }})();
    </script>
{SCRIPT_END}'''

_REACT = re.compile(r"react\(\s*\)")
_IMPORT_BLOCK = re.compile(r"^(?:import .*?;\s*)+", re.S)


def patch_config(src: str) -> str | None:
    """The Vite config with the plugin wired into its `react()` call, or
    None when it is already there or the config is shaped unexpectedly."""
    if MARKER in src:
        return None
    if not _REACT.search(src):
        log.info("vite config has no plain react() call; visual editing stays off")
        return None
    out = _REACT.sub(REACT_CALL, src, count=1)
    m = _IMPORT_BLOCK.match(out)
    at = m.end() if m else 0
    return out[:at] + "\n" + PLUGIN + "\n" + out[at:]


def patch_index(src: str) -> str | None:
    """index.html with the editor script before </body>, or None when it
    is already there."""
    if SCRIPT_START in src:
        return None
    if "</body>" not in src:
        return None
    return src.replace("</body>", f"    {SCRIPT}\n  </body>", 1)


def strip_script(html: str) -> str:
    """The built page without the editor script: it has nothing to do on a
    published site, so it does not ship."""
    start = html.find(SCRIPT_START)
    if start == -1:
        return html
    end = html.find(SCRIPT_END, start)
    if end == -1:
        return html
    end += len(SCRIPT_END)
    line_start = html.rfind("\n", 0, start) + 1
    if not html[line_start:start].strip():          # take the whole lines
        start = line_start
    if html[end:end + 1] == "\n":
        end += 1
    return html[:start] + html[end:]


async def ensure(sandbox: Sandbox) -> bool:
    """Make the running app editable. True when the preview will stamp
    locations from now on (a restart of the dev server is not needed: Vite
    reloads on a config change by itself)."""
    ok = True
    for path, patch in ((CONFIG, patch_config), (INDEX, patch_index)):
        try:
            src = await sandbox.read_file(path)
        except (FileNotFoundError, SandboxError) as e:
            log.info("visual editing: %s unavailable (%s)", path, e)
            ok = False
            continue
        try:
            fixed = patch(src)
            if fixed is not None:
                await sandbox.write_file(path, fixed)
                log.info("visual editing: patched %s", path)
            elif path == CONFIG and MARKER not in src:
                ok = False
        except SandboxError as e:
            log.warning("visual editing: could not write %s: %s", path, e)
            ok = False
    return ok
