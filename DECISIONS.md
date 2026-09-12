# Vivid Code builder: decisions

The builder is the Lovable-style prompt-to-app product. This file records what
was found in the repo, what the builder reuses, what it adds, and every choice
the brief left open. It is updated as phases land.

Scope for this work: **backend only** (`vivid-backend`). No change is made to
`vivid-frontend`; the stream and REST contract is documented in
`vivid-backend/docs/builder.md` for whoever builds the UI.

## 1. What is here (found 2026-09-12)

**Backend** (`vivid-backend`, Python 3.12, FastAPI 0.115)

- The single gateway between every client and the models. Nothing else may
  talk to a model host.
- SQLAlchemy 2 async on asyncpg, pgvector. Schema is `Base.metadata.create_all`
  plus idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in
  `app/db/session.py`. No Alembic.
- Redis for rate limits and the arq worker. MinIO in dev through
  `app/services/storage.py` (boto3, S3-compatible, so Cloudflare R2 works
  with a different endpoint and credentials).
- Auth: JWT access tokens and `vivid_` API keys share one bearer header and
  resolve to a `Principal` in `app/api/deps.py`. Routes take
  `get_current_user`.
- Model access: `app/services/models_gateway/provider.py` picks the upstream
  per role (our RunPod pods or OpenRouter). `code_llm.py` is an
  OpenAI-compatible streaming adapter with native tool calling: fragment
  reassembly, mid-stream error detection, transient retries. This is the
  adapter the builder uses.
- An agent loop already exists: `app/services/code_agent.py` runs a
  native-tool loop over `/ws/code` where the tools execute in the user's
  editor. Its shape (turn, execute, context trimming, retry) is the model for
  the builder loop, but the builder's tools run in a cloud sandbox, so it is
  a sibling, not a modification.
- `sandbox/` at the repo root is a locked-down Python code-execution
  container for the chat assistant's `run_code` tool. Not related to the
  app sandbox.
- `app/services/websites.py` extracts single-file HTML sites from chat
  replies. It is the builder's predecessor and stays as it is.
- Tests: pytest with `asyncio_mode = auto`, no Postgres. Route tests build a
  small FastAPI app with the router and override `get_principal`; DB tests
  use aiosqlite in memory.
- Naming: "Vivid Code" already names the terminal/editor coding agent
  (`vivid-code/`, `/ws/code`). Inside the backend the new product is the
  `builder` package and the `/v1/builder` routes, so the two never collide.

**Frontend** (`vivid-frontend`, Next.js 16.3.2 App Router, React 19)

- Out of scope for this work. Noted only for the contract: chat today is a
  browser websocket straight to FastAPI (`/ws`), and REST goes direct with the
  JWT in the `Authorization` header. The builder's stream is plain HTTP so any
  client, including a future `useChat`, can consume it.

**Models**: `OPENROUTER_API_KEY` is already a setting, and the OpenRouter
provider is already wired. Slugs from the brief verified against
`openrouter.ai/api/v1/models` on 2026-09-12:

| slot | slug | notes |
|---|---|---|
| plan / build / edit | `deepseek/deepseek-v4.1-flash` | text+image input, tools; $0.15/M in, $0.60/M out, $0.003/M cache read |
| fallback | `z-ai/glm-5.3-flash` | tools; $0.075/M in, $0.25/M out |
| comparison | `anthropic/claude-sonnet-5` | tools; $2/M in, $10/M out |

## 2. Brief vs this repo

The brief assumes a TypeScript orchestrator (Next route handlers, AI SDK,
Drizzle, `@openrouter/ai-sdk-provider`). This repo's rule is that the FastAPI
backend is the only thing that talks to a model host, and it already owns
auth, storage, rate limits and a tool-calling adapter. So the *architecture*
of the brief is kept and the *stack* maps onto what exists:

| brief | here | why |
|---|---|---|
| route handlers in Next | routes in `app/api/routes/builder.py` | the backend is the sole gateway |
| AI SDK `streamText` + `toUIMessageStreamResponse` | own loop + an encoder for the AI SDK **UI Message Stream v1** over SSE | same wire protocol, no TS runtime needed; a `useChat` client works unchanged |
| `@openrouter/ai-sdk-provider` | `code_llm.stream_chat` against an OpenRouter endpoint | already handles streaming tool calls and failures |
| Drizzle | SQLAlchemy models + `init_db` | one ORM in the service |
| R2 client | boto3 through a builder blob client | R2 is S3-compatible; MinIO in dev |
| `scripts/eval.ts` | `app/scripts/builder_eval.py` | same report, Python |

Everything else in the brief (tools, prompt rules, context budget, step cap,
routing by stage, fallback, snapshot-is-truth, phases) is unchanged.

## 3. Reuse vs add

Reused as-is: `deps.get_current_user`, `errors.APIError`, `provider.Endpoint`
and `provider.scrub`, `code_llm.stream_chat` (gains an optional explicit
endpoint), `storage`'s boto3 pattern, `rate_limit.check_bucket`,
`init_db` for schema, `cryptography` (already a dependency) for secrets.

Added under `vivid-backend/app/builder/`:

```
builder/
  stream.py          UI Message Stream v1 encoder (SSE)
  routing.py         stage -> OpenRouter endpoint (PLAN/BUILD/EDIT/FALLBACK_MODEL)
  sandbox/
    base.py          Sandbox interface + types
    e2b.py           E2B driver (template "vivid-web")
    local.py         local subprocess driver for dev and tests
    manager.py       get_or_create(project), restore, wait for :5173, idle kill
  tools.py           the six tools, executed against a Sandbox
  context.py         file tree + key files + recently touched, 12k cap
  prompt.py          static system prompt (< 120 lines) + injection
  loop.py            the turn: model call, tool execution, step cap, fallback
  snapshots.py       git commit -> tar -> blob store -> row      (phase 2)
  usage.py           usage_events + OpenRouter pricing           (phase 2)
  secrets.py         Fernet at rest                              (phase 2)
  planning.py        ask_user / write_spec stage                  (phase 3)
  supabase.py        Management API tools                         (phase 4)
  publish.py         vite build -> Cloudflare Pages               (phase 5)
  cloud.py           Vivid Cloud provisioning                     (phase 6)
api/routes/builder.py   /v1/builder/...
scripts/builder_eval.py
```

Template source lives in `sandbox-templates/vivid-web/` at the repo root
(the Vite project plus the E2B template definition).

## 4. Choices the brief left open

1. **Sandbox driver switch.** `SANDBOX_DRIVER=e2b|local`. `local` runs the
   same template in a temp directory on the host with `npm run dev`; it exists
   so the loop can be developed and its pass criteria run without an E2B key,
   and so unit tests never need the network. E2B is the production driver.
2. **Transport.** `POST /v1/builder/projects/{id}/chat` answers
   `text/event-stream` with `x-vercel-ai-ui-message-stream: v1`. Cancel is
   `POST .../cancel` (a Redis flag the loop checks between steps and per
   token). One turn per project at a time; a second request gets 409.
3. **Message storage.** `builder_messages.parts` holds the UI message parts
   exactly as streamed (text, tool, data parts), so a client can hydrate a
   thread without re-deriving anything.
4. **Schema up front.** All builder tables are created in phase 1 even though
   only projects and messages are used then. The brief's own reason applies:
   usage rows are cheap now and painful to retrofit.
5. **Tables are separate** (`builder_*`). The assistant's `chats`/`messages`
   are untouched; the two products have different rows and different
   lifecycles.
6. **Sandbox identity survives restarts.** The live sandbox id per project is
   kept in Redis (`builder:sandbox:{project_id}`) with the last-activity time.
   A backend restart reconnects instead of creating a second sandbox. An
   asyncio sweeper in the app lifespan kills sandboxes idle 10 minutes.
7. **Typecheck after writes** runs `npx tsc --noEmit -p .` in the sandbox with
   a 60 s ceiling and returns the first 40 error lines, as the brief says. It
   runs once per tool call, not once per turn, so the model sees the error
   next to the edit that caused it.
8. **Command blocklist** for `run_command`: anything touching `rm -rf /`,
   `sudo`, `curl | sh`, `git push`, `npm publish`, `shutdown`, package
   manager global installs, and any path outside the project. Package
   installs are allowed (`npm install <pkg>`).
9. **Pricing** for `usage_events.cost_usd` comes from OpenRouter's public
   `/models` listing, cached for an hour, keyed by slug; cache-read tokens are
   priced at the cache rate. If the listing is unreachable the row is written
   with `cost_usd = NULL` and a warning, never with a guess.
10. **Secrets at rest** use Fernet (`SECRETS_ENCRYPTION_KEY`, 32 url-safe
    base64 bytes). Tool results and the stream never carry a secret value;
    `set_secret` echoes only the key name.
11. **Eval** is `python -m app.scripts.builder_eval --build <slug> --driver e2b|local`,
    reports steps, typecheck failures, tokens and cost per prompt, and writes
    a JSON file so two runs can be diffed.

## 5. Open questions (answered by assumption until told otherwise)

1. E2B account: a key was provided on 2026-09-12 and lives in the backend's
   untracked `.env`. The `vivid-web` template is built from
   `sandbox-templates/vivid-web/template.py` (Template SDK, fluent API, since
   the Dockerfile route was not needed); phase 1 is proven on E2B.
2. R2 credentials: none present. Assumed: MinIO in dev (the existing S3
   settings), R2 in production via `R2_*` settings.
3. Plan-mode answers: the `ask_user` questions are persisted as a tool part;
   the client answers by sending the next user message. Assumed acceptable.
4. Cloud gating: a `plan` column on the existing `users` table (free/pro).
   Assumed acceptable.

## 6. Phase 1 result (2026-09-12)

Run through `/v1/builder` against E2B and OpenRouter with the configured
models (build/edit deepseek/deepseek-v4.1-flash, fallback z-ai/glm-5.3-flash),
one project, prompts back to back:

| prompt | steps | typecheck | fallback | wall time |
|---|---|---|---|---|
| todo app with dark mode | 7 | clean | no | 126 s |
| add a counter page + nav | 6 | clean | no | 76 s |
| make buttons rounded and blue | 5 | clean | no | 78 s |
| install zustand and use it | 10 | clean | no | 92 s |
| fix the delete button (after breaking it) | 5 | clean | no | 34 s |

Sandbox boot to dev server: about 5 s. A typecheck after a write: 4 to 6 s.
The template build on E2B takes 45 s.

Two things learned and fixed on the way: build steps in the Template SDK run
as `user`, so apt needs `user="root"`; and nothing may be awaited after the
stream's terminator, because the client closing the connection cancels it
silently (the assistant message is now stored before `[DONE]`).

Known gap, by design until phase 2: a sandbox that dies (idle kill, the E2B
lifetime, a backend restart past it) comes back as a fresh template, so the
app built so far is lost. Snapshots are the fix.

## 7. Phase 2 result (2026-09-12)

R2 bucket and key were provided; objects live under `R2_PREFIX` because the
bucket is shared with another product. Run live on E2B and R2:

| step | result |
|---|---|
| build turn, notes app | 5 steps, snapshot seq 1, 74 KB |
| edit turn, heading change | 2 steps, snapshot seq 2, 76 KB |
| sandbox killed out of band, then `preview` | fresh sandbox restored from seq 2 in 5 s, App.tsx identical |
| `restore` to seq 1 | 3 s, App.tsx back to the build version, no npm install |
| next turn after the restore | snapshot seq 3 |
| `usage` | 12 model calls, 70k tokens, $0.0094, 227 KB storage |
| `DELETE` project | rows cascade, R2 prefix emptied |

Choices made here: a chat-only turn stores no snapshot (git reports no
change); the snapshot is taken in the same transaction as the assistant
message, and a snapshot failure is logged but does not fail the turn (the
next changing turn captures the work); sandbox sessions are metered when a
sandbox is killed or found dead, so seconds appear a little after the fact.

## 8. Phase 3 choices (2026-09-12)

- `mode` column on projects: `plan` for new rows, `build` after
  `POST .../build`; rows from before phase 3 default to `build` (they skip
  plan mode, as the brief asks). `skip_plan` on create is for developers
  who know what they want.
- Plan turns run without a sandbox. Nothing is created on E2B until the
  build starts, so an abandoned idea costs tokens only.
- `ask_user` ends the turn; the answers are the next user message in plain
  text. The stored tool part holds the questions, so a client can render
  cards from the thread and the model's history shows what it asked.
- The spec is validated for the six headings before it is accepted; a bad
  spec goes back to the model as an error result.
- `spec.md` is rewritten in the sandbox at the start of any build turn where
  it differs from the project's spec (covers an edited spec and a fresh
  sandbox). It rides along in the next snapshot.
- Reference images: `images` on the chat body, forwarded as `image_url`
  parts in plan mode only.

### Phase 3 result (2026-09-12, live)

| step | result |
|---|---|
| plan turn 1, "a booking app for my salon in Lagos" | first `ask_user` call had broken JSON, was fed back, retried: 6 questions with 3 options each, 16 s |
| plan turn 2, answers | `write_spec` with all six headings, 9 s; no sandbox created |
| `PATCH` spec, `POST .../build` | mode build; spec.md written to the sandbox and identical to the edited spec |
| build turn from the spec | DeepSeek hit 3 typecheck failures in a row; fallback to GLM-5.3-flash finished: 15 steps, 25 tools, 4 pages, 385 s |

Also found on the way: the OpenRouter provider dropped a stream mid-reply
once ("Stream interrupted"). Both runners now restart a broken model call
(`CODE_STREAM_RETRIES`) and, if the primary keeps failing, use the fallback
vendor. Worth watching: DeepSeek's first pass on a multi-page spec leaned on
the fallback; `builder_eval` is the tool for deciding whether BUILD_MODEL
should change.

## 9. Phase 4 choices (2026-09-12)

- Supabase is a **connector**, like GitHub: one row per user, reused by all
  their projects. Two ways in: the OAuth button (needs our registered app)
  and a pasted personal access token. The connector row exposes the
  account's projects so a client can offer a picker.
- Connector tokens are now encrypted at rest (Fernet), closing the TODO on
  the table; legacy plaintext rows still read.
- Per-project link: `backend_mode = byo` + `supabase_project_ref`, with the
  project URL and publishable key in `builder_secrets`. A user with only
  project keys can paste them: the app gets its env, the tools stay off
  because they need a Management API token.
- `.env` is git-ignored in the template and rewritten every build turn, so
  keys never enter a snapshot and a fresh sandbox gets them back.
- Migrations go through `POST /database/migrations` (recorded in history),
  not the raw query endpoint. Edge functions use the multipart `deploy`
  endpoint with `index.ts` as the entrypoint. Secrets use the bulk endpoint;
  the tool never echoes a value.
- Still needed from the owner to prove the tool path live: a personal
  access token (or the OAuth app). The client env path was verified live
  against the provided project.

## 10. Phase 5 choices (2026-09-12)

- No domain yet, so apps publish to `<alias>.<project>.pages.dev` on one
  Pages project; the hostname pattern is a setting for when a domain
  arrives. Pages custom domains apply to a project's production branch,
  not to branch aliases, so `name.vividcode.app` per app will need either
  one Pages project per app or a small router in front. Decided when the
  domain exists; nothing in the API changes.
- The sandbox builds, the backend uploads. Running Wrangler inside the
  sandbox would have been less code but would put the account-wide Pages
  token where user code runs.
- Direct upload implemented as Wrangler does it (upload token, check
  missing, batched base64 upload, upsert hashes, manifest deployment);
  the hash is blake3(base64 body + extension)[:32], verified against
  `packages/deploy-helpers/src/deploy/helpers/hash.ts`.
- Publish is a background task with a row to poll, not a stream: a build
  plus upload takes a minute, and the client already polls snapshots the
  same way.

### Phase 5 result (2026-09-12, live)

| step | result |
|---|---|
| build turn, bakery landing page | 4 steps, 287 s (slow model day) |
| first publish | failed after the build: a dropped connection on the E2B keep-alive call, which the driver treated as fatal. Now a warning |
| second publish | live in 118 s at `https://lagos-bakery-db8bc1.vivid-apps.pages.dev` |
| checks | page 200; `/some/route` 200 (SPA fallback); JS bundle served as text/javascript and contains the bakery copy and naira prices |

The Pages project `vivid-apps` was created by the first publish. Nothing
unpublishes yet: deleting a project leaves its alias live until a later
phase adds deployment deletion.

## 11. Uploaded assets (2026-09-12)

Asked for after phase 5: "users can drop assets, the AI should ask about
pictures". Files go to R2 and into the app at `public/uploads/<name>`
(served at `/uploads/<name>`), so they are ordinary static files in the
build and in snapshots. The plan prompt now always asks about a logo,
photos and brand colours for anything visual, the uploaded list is in every
prompt, and plan turns see the images. Chosen over storing uploads only in
R2 and rewriting URLs, because a static file in `public/` needs no runtime
and publishes with the site.

### Found by the sneaker-store run (2026-09-12)

A first build with uploads ran 1190 s, longer than the sandbox's 900 s E2B
lifetime, which was extended only between turns. The sandbox died
mid-turn, the next request made a fresh one, and uploads were synced only
on chat turns, so the fresh sandbox had no uploads and publish shipped the
bare template. Fixed: the turn extends the sandbox after every step; a
fresh sandbox is given spec.md, .env and the uploads on every route; the
plan model writes the spec after at most two rounds of questions; E2B
create retries once on a dropped connection.

## 12. Design quality (2026-09-12)

The owner's concern: AI-built sites look generated. Built as three parts, all
automatic and invisible to users:

- **Skills.** A folder of packaged expertise (`skills/design/SKILL.md`,
  references, recipes) attached to a turn by the loader, the way Claude Code
  loads a skill by matching a task to its description. Here the match is by
  project state: design skill on every UI turn, one recipe by words in the
  spec. Files in the repo, so a design change is a reviewed diff and can be
  measured.
- **Seeing the page.** Chromium is baked into the sandbox template
  (`scripts/screenshot.mjs`), so the loop screenshots the dev server at
  desktop and phone widths after the model answers, and the model critiques
  and fixes its own page. Chosen over the separate Playwright service: no
  extra deployment, the preview URL needs no auth from inside the sandbox,
  and it works on the local driver too.
- **Images when the user has none.** A `generate_image` tool through the
  existing OpenRouter image gateway, stored as an asset. The sneaker run
  showed the gap: my test uploads were flat colour blocks and the page
  faithfully showed flat colour blocks. Logos are not generated; the skill
  uses a wordmark, because text logos stay sharp and generated marks do not.
- **Measuring.** `design_eval` renders each spec as A (skill and critique
  off) and B (on), publishes both, and a different vendor's model scores
  the screenshots blind. The rule: a skill change that does not move the
  score does not ship.

### Thin first builds (2026-09-12)

The sneaker site came out with two products and two real pages. Cause: the
static prompt told the model to "finish in as few tool calls as you can",
and a first build shared the 20 step cap of a one-line edit. Changed: the
prompt now defines a complete first build (all spec pages routed and
linked, eight or more seeded items with images, every recipe section, admin
reachable) and keeps edits minimal; first builds get 40 steps; after the
answer a completeness review compares the app with the spec and fills gaps
before the visual critique; recipes carry explicit minimums.

### First designed result (2026-09-12)

Leather-bag store, no uploads, design skill and critique on, images
generated: https://adire-and-hide-32ea78.vivid-apps.pages.dev. 13 steps, 37
tool calls (7 images, 6 kept), 21 minutes, one critique round that fixed the
phone hero crop and the mobile menu. Wordmark, editorial serif, warm palette,
real product photography, trust strip, footer with address and hours; phone
layout stacks cleanly. Built before the completeness rules, so five products
rather than eight or more. Wall time is the cost to watch: a first build
with images and a critique is 15 to 25 minutes on the current models.

### Lost work on restart (2026-09-12)

A backend restart killed the live sneaker sandbox (the shutdown hook
killed every sandbox) before its snapshot existed, so the code was lost
while the published site stayed up. Two changes: sandboxes are left alive
at shutdown by default (`BUILDER_KILL_SANDBOXES_ON_SHUTDOWN=false`; Redis
lets the next process reconnect and E2B's timeout reaps the rest), and
`public/uploads` is excluded from snapshots because assets already live in
R2 and are synced back on restore. The 13.7 MB snapshot the images made
was also why the end-of-turn read had timed out. Snapshots are back to
kilobytes.
