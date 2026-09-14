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
import asyncio
import logging
import re

from app.builder.sandbox.base import DEV_LOG, Sandbox, SandboxError

log = logging.getLogger("vivid.builder.editor")

MARKER = "vivid-source-location"
#: The injected plugin sits between these, so a newer backend can replace
#: an older plugin in a project that already carries one.
BLOCK_START = "// vivid:loc-plugin"
BLOCK_END = "// /vivid:loc-plugin"
CONFIG = "vite.config.ts"
INDEX = "index.html"
SCRIPT_START = "<!-- vivid:editor -->"
SCRIPT_END = "<!-- /vivid:editor -->"

#: Added to the dev server's Babel run. It goes in as the first attribute
#: so that a component spreading {...props} onto its root passes the call
#: site's location down to the element the user actually clicks.
PLUGIN = """
// Gives the builder's visual editor an anchor: while the dev server runs,
// every element carries the file, line and column it was written at. The
// dev JSX runtime already knows that (it is what React DevTools shows), so
// this wraps it rather than parsing anything. `apply: "serve"` keeps it out
// of every production build.
function vividSourceLocation() {
  const VIRTUAL = String.fromCharCode(0) + "vivid-jsx-dev";
  const REAL = "react/jsx-dev-runtime";
  return {
    name: "vivid-source-location",
    enforce: "pre",
    apply: "serve",
    resolveId(source, importer) {
      if (source !== REAL || importer === VIRTUAL) return null;
      return VIRTUAL;
    },
    load(id) {
      if (id !== VIRTUAL) return null;
      return [
        'import * as runtime from "' + REAL + '";',
        "export const Fragment = runtime.Fragment;",
        "export function jsxDEV(type, props, key, isStatic, source, self) {",
        "  if (source && typeof source.fileName === 'string') {",
        "    const at = source.fileName.lastIndexOf('/src/');",
        "    if (at !== -1) {",
        "      const where = source.fileName.slice(at + 1) + ':' + source.lineNumber",
        "        + ':' + (source.columnNumber - 1);",
        "      props = Object.assign({ 'data-vivid-loc': where }, props);",
        "    }",
        "  }",
        "  return runtime.jsxDEV(type, props, key, isStatic, source, self);",
        "}",
      ].join(String.fromCharCode(10));
    },
  };
}
""".strip()

#: How the plugin is wired into the config's plugin list, and the shape the
#: first version used (a Babel plugin, which the React plugin no longer
#: runs), so a project carrying that upgrades cleanly.
WIRED = "vividSourceLocation(), react("
LEGACY_REACT_CALL = "react({ babel: { plugins: [vividSourceLocation] } })"

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


BLOCK = f"{BLOCK_START}\n{PLUGIN}\n{BLOCK_END}"
_BLOCK_RE = re.compile(re.escape(BLOCK_START) + r".*?" + re.escape(BLOCK_END), re.S)
#: The first shipped plugin went in without sentinels; recognise it so a
#: sandbox started in that window upgrades instead of staying half-wired.
_LEGACY_RE = re.compile(r"//[^\n]*Stamps each JSX element.*?\n\}\n", re.S)


def _wire(src: str) -> str:
    """The config's plugin list with the stamping plugin in front of the
    React one, whatever shape it was in before."""
    if LEGACY_REACT_CALL in src:                      # the first, Babel-based shape
        src = src.replace(LEGACY_REACT_CALL, "react()", 1)
    if WIRED in src:
        return src
    return _REACT.sub("vividSourceLocation(), react()", src, count=1)


def patch_config(src: str) -> str | None:
    """The Vite config with the current plugin defined and wired in, or
    None when it is already exactly that. A project carrying an older
    version has it replaced in place; everything else in the config is left
    alone, and a config shaped unexpectedly is not touched at all."""
    if BLOCK in src and WIRED in src:
        return None
    for pattern in (_BLOCK_RE, _LEGACY_RE):
        if pattern.search(src):
            return _wire(pattern.sub(lambda _: BLOCK + "\n", src, count=1))
    if MARKER in src:                       # hand-edited beyond recognition
        log.info("vite config carries an unknown stamping plugin; left as it is")
        return None
    if not _REACT.search(src):
        log.info("vite config has no plain react() call; visual editing stays off")
        return None
    out = _wire(src)
    m = _IMPORT_BLOCK.match(out)
    at = m.end() if m else 0
    return out[:at] + "\n" + BLOCK + "\n" + out[at:]


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


#: Vite reloads its config on a change and says so in the dev log, so the
#: dev server is the checker: anything it could not load is put back within
#: a couple of seconds. No extra tooling to be missing from a sandbox.
CONFIG_FAILURES = ("restart failed", "failed to load config")
CONFIG_SETTLE_SECONDS = 2.5


async def _log_lines(sandbox: Sandbox) -> int:
    try:
        result = await sandbox.run(f"wc -l < {DEV_LOG} 2>/dev/null || echo 0", timeout=15)
        return int((result.stdout or "0").strip() or 0)
    except (SandboxError, ValueError):
        return 0


async def _config_loaded(sandbox: Sandbox, since: int) -> bool:
    """Whether Vite took the config we just wrote. Only the lines it added
    after the write are read, so an older failure is not blamed on us."""
    await asyncio.sleep(CONFIG_SETTLE_SECONDS)
    try:
        result = await sandbox.run(f"tail -n +{since + 1} {DEV_LOG} 2>/dev/null || true", timeout=15)
    except SandboxError as e:
        log.warning("visual editing: could not read the dev log (%s)", e)
        return True                                  # no evidence of harm
    said = (result.stdout or "").lower()
    if any(bad in said for bad in CONFIG_FAILURES):
        log.error("visual editing: the dev server refused the patched config: %s", said[-300:])
        return False
    return True


async def ensure(sandbox: Sandbox) -> bool:
    """Make the running app editable, and leave it exactly as it was if
    anything about that is not safe. True when the preview will stamp
    locations from now on; Vite picks up the config change by itself."""
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
            if fixed is None:
                if path == CONFIG and BLOCK not in src:
                    ok = False
                continue
            since = await _log_lines(sandbox) if path == CONFIG else 0
            await sandbox.write_file(path, fixed)
            if path == CONFIG and not await _config_loaded(sandbox, since):
                await sandbox.write_file(path, src)          # exactly as it was
                log.error("visual editing: config patch reverted for this project")
                ok = False
                continue
            log.info("visual editing: patched %s", path)
        except SandboxError as e:
            log.warning("visual editing: could not write %s: %s", path, e)
            ok = False
    return ok
