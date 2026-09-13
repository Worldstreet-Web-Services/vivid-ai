"""Plan mode: a new project is talked through before anything is built.

The model gets two tools and no sandbox. `ask_user` puts two to six
questions to the user, each with options and room for free text, and ends
the turn: the answers arrive as the next user message. `write_spec` stores
the spec, which is then injected into every build turn and committed as
spec.md. The user can edit the spec (PATCH) and starts the build explicitly
(POST .../build). Existing projects never enter plan mode.

The spec template is fixed: goal, users, pages, data model, integrations,
out of scope. Small, so the build model reads it every step for nothing.
"""
import json
import logging
from dataclasses import dataclass, field
from typing import AsyncIterator, Callable

from app.builder import routing, skills, stream
from app.builder import meta
from app.builder.loop import ModelStep

log = logging.getLogger("vivid.builder.planning")

ASKED = "asked"
SPEC_WRITTEN = "spec_written"
ANSWERED = "answered"
STEP_LIMIT = "step_limit"
CANCELLED = "cancelled"
ERROR = "error"

MIN_QUESTIONS, MAX_QUESTIONS = 2, 6
MIN_OPTIONS, MAX_OPTIONS = 2, 4
MAX_STEPS = 6
MAX_IMAGES = 4

SPEC_SECTIONS = ("Goal", "Users", "Pages", "Data model", "Integrations", "Out of scope")

SCHEMAS = [
    {"type": "function", "function": {
        "name": "ask_user",
        "description": (
            "Ask the user between two and six questions to pin down what to build. "
            "Each question has two to four short options; the user may also answer in "
            "their own words. Ask only what changes what you would build. This ends "
            "your turn; the answers arrive as the next message."),
        "parameters": {
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array", "minItems": MIN_QUESTIONS, "maxItems": MAX_QUESTIONS,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "description": "Short key, e.g. 'audience'."},
                            "question": {"type": "string"},
                            "options": {"type": "array", "minItems": MIN_OPTIONS,
                                        "maxItems": MAX_OPTIONS, "items": {"type": "string"}},
                            "allow_free_text": {"type": "boolean",
                                                "description": "Default true."},
                        },
                        "required": ["id", "question", "options"],
                    },
                },
            },
            "required": ["questions"],
        }}},
    {"type": "function", "function": {
        "name": "write_spec",
        "description": (
            "Write the spec once you know enough. Markdown with exactly these "
            "headings, in order: Goal, Users, Pages, Data model, Integrations, "
            "Out of scope. Concrete and short: a builder reads it every step."),
        "parameters": {
            "type": "object",
            "properties": {
                "markdown": {"type": "string"},
                "recipe": {
                    "type": "string",
                    "description": (
                        "The page recipe closest to this app, by name from the list in "
                        "the instructions; omit when none fits.")},
                "fullstack": {
                    "type": "boolean",
                    "description": (
                        "true only when the user asked for accounts, sign-in, per-user "
                        "data, an owner or admin who manages live records, or said "
                        "full-stack or backend. A site, a portfolio, a landing page, a "
                        "simple shop with an order form is false (the default).")},
            },
            "required": ["markdown"],
        }}},
]

def tool_schemas() -> list[dict]:
    """The plan tools with the recipe list of the moment: recipes are files,
    so the enum is read when a turn starts, not when the module loads."""
    out = json.loads(json.dumps(SCHEMAS))
    names = skills.recipe_names()
    if names:
        out[1]["function"]["parameters"]["properties"]["recipe"]["enum"] = names
    return out


SYSTEM = """You are Vivid, planning a web app with the user before it is built. The user \
may not be a developer. The app will be a React single-page app built from a template \
(Vite, TypeScript, Tailwind, shadcn/ui). Data and login, when needed, come from Supabase.

Your job in this conversation:
1. Read the idea. If a screenshot or image was attached, treat it as the reference design.
2. Ask the few questions that change what gets built (who it is for, the main pages, \
what data it keeps, whether customers sign in, who manages the site and how they sign in \
to the owner area, payments or other integrations, look and \
feel). Two to six questions with concrete options. Do not ask what you can decide well \
yourself, and do not ask twice.
   Always include one question about pictures and branding when the app would show \
any (a shop, a portfolio, a restaurant, a brand site): do they have a logo, product \
photos or brand colours to upload now, or should the first version use placeholders? \
The user uploads files beside the chat; uploaded files are listed for you under \
"Files the user uploaded" and appear at /uploads/<name> in the app. If they have no \
pictures, say the builder will generate product and hero images and set the brand name \
as a wordmark, and put that in the spec.
   By default the app is a site: pages, a catalogue, forms, a cart, an owner area with a \
PIN, all kept in the browser. It becomes a full-stack app (real sign-up and sign-in, \
records that live on a server, roles, an owner who manages live orders or jobs) only when \
the user asks for that, in those words or in what the idea needs (a delivery platform where \
riders, senders and a dispatcher each see their own jobs cannot be a site). If the idea \
sits on the line, ask. Full-stack is the `fullstack` flag on write_spec; its spec says \
"Supabase (accounts, data)" under Integrations, and your closing sentence tells the user \
they will connect their Supabase project in the project settings before the build.
3. When you know enough, call write_spec. One round of questions is normal, two is \
the most; after the user has answered twice, write the spec with sensible choices for \
anything still open rather than asking again. \
If files were uploaded, name them in the spec where they are used (the logo in the \
header, each product photo on its product).

Pick the page recipe closest to the app for write_spec's `recipe` (the builder \
follows it for pages and sections):
{recipes}

The spec has exactly these headings, in this order, each with a few plain lines or \
bullets: Goal, Users, Pages, Data model, Integrations, Out of scope. Pages lists each \
page and what is on it. Data model lists each thing the app stores and its fields. \
Integrations says "none" or names them (Supabase auth, payments, email). Out of scope \
says what this first version deliberately leaves out.

Between tool calls write at most one short sentence. After write_spec, tell the user in \
one or two sentences what the spec covers and that they can edit it or start the build. \
Never write code, and never describe the code you would write.
"""


@dataclass
class PlanResult:
    reason: str = ERROR
    steps: int = 0
    model: str = ""
    spec_md: str | None = None
    questions: list[dict] | None = None
    fullstack: bool = False
    recipe: str | None = None
    #: The expanded brief from the first turn's meta-prompt.
    brief_md: str | None = None
    calls: list = field(default_factory=list)


def validate_questions(raw) -> tuple[list[dict] | None, str | None]:
    """The model's questions, normalised, or an error it can act on."""
    if not isinstance(raw, list) or not MIN_QUESTIONS <= len(raw) <= MAX_QUESTIONS:
        return None, f"give between {MIN_QUESTIONS} and {MAX_QUESTIONS} questions"
    out = []
    for i, q in enumerate(raw):
        if not isinstance(q, dict):
            return None, f"question {i + 1} is not an object"
        text = str(q.get("question") or "").strip()
        options = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
        if not text:
            return None, f"question {i + 1} has no text"
        if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
            return None, (f"question {i + 1} needs {MIN_OPTIONS} to {MAX_OPTIONS} options, "
                          f"got {len(options)}")
        out.append({"id": str(q.get("id") or f"q{i + 1}").strip()[:40] or f"q{i + 1}",
                    "question": text[:300], "options": [o[:120] for o in options],
                    "allow_free_text": bool(q.get("allow_free_text", True))})
    return out, None


def validate_spec(markdown) -> tuple[str | None, str | None]:
    if not isinstance(markdown, str) or len(markdown.strip()) < 80:
        return None, "the spec is empty or too short"
    text = markdown.strip()
    missing = [h for h in SPEC_SECTIONS if h.lower() not in text.lower()]
    if missing:
        return None, "the spec is missing these headings: " + ", ".join(missing)
    return text[:20_000], None


def history_from_parts(messages: list) -> list[dict]:
    """Stored plan-mode messages as the model sees them: the questions it
    asked and the spec it wrote become assistant text, so a later turn
    knows what was already covered."""
    out = []
    for m in messages:
        chunks = []
        for p in m.parts or []:
            kind = p.get("type", "")
            if kind == "text" and p.get("text"):
                chunks.append(p["text"])
            elif kind == "tool-ask_user":
                qs = (p.get("input") or {}).get("questions") or []
                lines = ["I asked:"]
                for q in qs:
                    lines.append(f"- {q.get('question')} (options: "
                                 f"{', '.join(q.get('options') or [])})")
                chunks.append("\n".join(lines))
            elif kind == "tool-write_spec":
                md = (p.get("input") or {}).get("markdown")
                if md:
                    chunks.append("I wrote this spec:\n" + md)
            elif kind == "data-brief":
                md = (p.get("data") or {}).get("markdown")
                if md:
                    chunks.append("Here is how I understand the idea:\n\n" + md)
        text = "\n".join(chunks).strip()
        if text:
            out.append({"role": m.role, "content": text})
    return out


def user_content(text: str, images: list[str] | None):
    """A user message, with reference images when the model takes them."""
    if not images:
        return text
    parts = [{"type": "text", "text": text}]
    for url in images[:MAX_IMAGES]:
        parts.append({"type": "image_url", "image_url": {"url": url}})
    return parts


class PlanRunner:
    def __init__(self, history: list[dict], user_text: str,
                 images: list[str] | None = None,
                 cancelled: Callable[[], bool] = lambda: False,
                 message_id: str | None = None,
                 assets_block: str = "",
                 brief: bool = True) -> None:
        self.history = history
        self.assets_block = assets_block
        #: Run the prompt builder on a project's first message.
        self.brief = brief
        self.user_text = user_text
        self.images = images
        self.cancelled = cancelled
        self.message_id = message_id or stream.new_id("msg")
        self.result = PlanResult()

    async def run(self) -> AsyncIterator[dict]:
        yield stream.start(self.message_id)
        endpoint = routing.endpoint_for(routing.PLAN)
        self.result.model = endpoint.model
        system = SYSTEM.replace("{recipes}", skills.recipe_menu() or "- (none on disk)")
        system += ("\n" + self.assets_block if self.assets_block else "")
        messages = [{"role": "system", "content": system}]
        messages += self.history

        if self.brief and meta.needs_brief(self.history, self.user_text):
            # The prompt builder: the one-liner becomes a brief first. It is
            # streamed as ordinary text (the user reads it), kept as a
            # data-brief part for clients that show it as a card, and
            # handed to the planner as what was understood.
            yield stream.start_step()
            expansion = meta.Expansion(self.user_text, self.images)
            async for part in expansion.run():
                yield part
            yield stream.finish_step()
            if expansion.text:
                self.result.brief_md = expansion.text
                self.result.calls.append((endpoint.model, expansion.usage))
                yield stream.data("brief", {"markdown": expansion.text})
                messages.append({"role": "user", "content": user_content(self.user_text, self.images)})
                messages.append({"role": "assistant",
                                 "content": "Here is how I understand the idea:\n\n" + expansion.text})
                messages.append({"role": "user", "content": (
                    "Good. Now ask me only what changes what you would build, using ask_user; "
                    "take the brief's defaults for the rest.")})
            else:
                messages.append({"role": "user", "content": user_content(self.user_text, self.images)})
        else:
            messages.append({"role": "user", "content": user_content(self.user_text, self.images)})

        for _ in range(MAX_STEPS):
            if self.cancelled():
                yield stream.abort("cancelled by the user")
                self.result.reason = CANCELLED
                break
            self.result.steps += 1
            yield stream.start_step()
            call_step = ModelStep(messages, tool_schemas(), endpoint)
            async for part in call_step.run():
                yield part
            if call_step.failed is not None:
                yield stream.error(call_step.failed.public)
                self.result.reason = ERROR
                break
            self.result.calls.append((endpoint.model, call_step.usage))
            text, calls = call_step.text, call_step.calls

            if not calls:
                messages.append({"role": "assistant", "content": text})
                yield stream.finish_step()
                # The closing line after write_spec keeps that outcome.
                if self.result.reason != SPEC_WRITTEN:
                    self.result.reason = ANSWERED
                break

            messages.append({
                "role": "assistant", "content": text or None,
                "tool_calls": [{"id": c["id"], "type": "function",
                                "function": {"name": c["name"],
                                             "arguments": json.dumps(c["arguments"])}}
                               for c in calls]})
            ended = False
            for call in calls:
                yield stream.tool_input(call["id"], call["name"], call["arguments"])
                content, ended_here = self._handle(call)
                if content.startswith("error:"):
                    yield stream.tool_error(call["id"], content)
                else:
                    yield stream.tool_output(call["id"], content)
                messages.append({"role": "tool", "tool_call_id": call["id"],
                                 "name": call["name"], "content": content})
                ended = ended or ended_here
            yield stream.finish_step()
            if ended:
                break
        else:
            self.result.reason = STEP_LIMIT

        if self.result.reason == SPEC_WRITTEN:
            yield stream.data("spec", {"markdown": self.result.spec_md})
        yield stream.data("usage", {
            "model": self.result.model, "steps": self.result.steps,
            "reason": self.result.reason, "mode": "plan"})
        yield stream.finish()

    def _handle(self, call: dict) -> tuple[str, bool]:
        """Tool result text and whether the turn ends here."""
        if call.get("error"):
            return f"error: {call['error']}. Call the tool again with valid JSON.", False
        args = call["arguments"]
        if call["name"] == "ask_user":
            questions, problem = validate_questions(args.get("questions"))
            if problem:
                return f"error: {problem}.", False
            self.result.questions = questions
            self.result.reason = ASKED
            return "Asked the user. Their answers arrive as the next message.", True
        if call["name"] == "write_spec":
            spec, problem = validate_spec(args.get("markdown"))
            if problem:
                return f"error: {problem}.", False
            self.result.spec_md = spec
            self.result.fullstack = bool(args.get("fullstack", False))
            recipe = str(args.get("recipe") or "").strip().lower()
            self.result.recipe = recipe if recipe in skills.recipe_names() else None
            self.result.reason = SPEC_WRITTEN
            return "Spec saved. Tell the user what it covers in one or two sentences.", False
        return f"error: no tool named {call['name']!r} in plan mode.", False
