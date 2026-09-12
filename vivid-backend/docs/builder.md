# The app builder

`/v1/builder` is the backend of the prompt-to-app product: a user describes
an app, an agent writes it inside a sandbox, and the user watches the preview.
This document is the contract a client builds against. The code is in
`app/builder/` and `app/api/routes/builder.py`.

## Routes

All routes take the usual bearer token (a session or a `vivid_` key) and
only ever see the caller's own projects.

```
POST   /v1/builder/projects                 {name?}            -> project
GET    /v1/builder/projects                                    -> [project]
GET    /v1/builder/projects/{id}                               -> project
PATCH  /v1/builder/projects/{id}            {name?, spec_md?}  -> project
DELETE /v1/builder/projects/{id}            kills the sandbox too
GET    /v1/builder/projects/{id}/messages                      -> [message]
POST   /v1/builder/projects/{id}/chat       {text}             -> event stream
POST   /v1/builder/projects/{id}/cancel                        -> {cancelled}
GET    /v1/builder/projects/{id}/preview                       -> {url, sandbox_id, driver}
GET    /v1/builder/projects/{id}/files                         -> {files: [path]}
GET    /v1/builder/projects/{id}/files/{path}                  -> {path, content}
```

Errors use the backend's envelope (`{"error": {"code", "message"}}`). Codes a
client should branch on: `busy` (409, a turn is already running), `rate_limited`
(429), `not_configured` (503, no model key), `sandbox_unavailable` (503).

## The chat stream

`POST .../chat` answers `text/event-stream` with the header
`x-vercel-ai-ui-message-stream: v1`. It is the AI SDK UI Message Stream, so a
client using `useChat` with the default transport pointed at this route (or a
route that pipes it through) renders it with no adapter. Each event is
`data: <json>`; the stream ends with `data: [DONE]`.

Parts, in the order a turn produces them:

```
{"type":"start","messageId":"msg_..."}
{"type":"start-step"}
{"type":"text-start","id":"txt_..."}                 the model talking
{"type":"text-delta","id":"txt_...","delta":"..."}
{"type":"text-end","id":"txt_..."}
{"type":"tool-input-available","toolCallId":"...","toolName":"edit_file","input":{...}}
{"type":"tool-output-available","toolCallId":"...","output":"Edited src/App.tsx.\nTypecheck: clean."}
{"type":"tool-output-error","toolCallId":"...","errorText":"error: ..."}
{"type":"finish-step"}
... more steps ...
{"type":"data-notice","data":{"text":"Retrying with a different model.","reason":"step_limit"}}
{"type":"data-usage","data":{"model":"...","steps":7,"tokens_in":..,"tokens_out":..,"reason":"answered"}}
{"type":"error","errorText":"..."}                   the turn failed; stream still ends normally
{"type":"abort","reason":"cancelled by the user"}
{"type":"finish"}
```

Tool names: `read_file`, `write_file`, `edit_file`, `list_files`,
`run_command`, `get_dev_server_logs`. Tool outputs are strings, at most 4,000
characters. A client that wants to show "what the agent is doing" renders the
tool parts; one that wants only the conversation renders the text parts.

The preview is the sandbox's dev server with hot reload: point an iframe at
the `preview` URL and it updates as files are written. Fetch `preview` once
per project and again after a `sandbox_unavailable`; each call also keeps the
sandbox alive (it is killed after ten idle minutes).

## Stored messages

`GET .../messages` returns each message's `parts` exactly as streamed, folded:
text deltas become one `{"type":"text","text"}` part, a tool call becomes one
`{"type":"tool-<name>","toolCallId","state","input","output"|"errorText"}` part,
and `step-start`, `data-*` parts are kept in order. The user's own message is
a single text part. A thread reloaded from here is the same shape a client
holds after watching the stream.

## Models and configuration

```
OPENROUTER_API_KEY   required
PLAN_MODEL           plan mode (phase 3)             default deepseek/deepseek-v4.1-flash
BUILD_MODEL          first turn on the empty template default deepseek/deepseek-v4.1-flash
EDIT_MODEL           every later turn                 default deepseek/deepseek-v4.1-flash
FALLBACK_MODEL       one retry on step cap / 3 typecheck failures   default z-ai/glm-5.3-flash
SANDBOX_DRIVER       e2b (production) | local (dev)
E2B_API_KEY, E2B_TEMPLATE=vivid-web
BUILDER_TEMPLATE_DIR path to sandbox-templates/vivid-web (local driver, eval)
```

A turn is capped at `BUILDER_MAX_STEPS` (20) tool calls. If the primary model
hits the cap or fails the typecheck `BUILDER_TYPECHECK_STRIKES` (3) times in a
row, the turn is retried once on `FALLBACK_MODEL`, and the stream says so with
a `data-notice` part and a line of text.

## The sandbox

The template `sandbox-templates/vivid-web` is Vite, React 19, TypeScript,
Tailwind v4 and shadcn/ui with node_modules installed and git initialised;
the dev server runs on port 5173. On E2B it is a custom template built with
`python sandbox-templates/vivid-web/template.py`. Locally
(`SANDBOX_DRIVER=local`) the same directory is copied per project and
`npm run dev` started as a child process; run `npm install` in the template
directory once first.

## Evaluating models

```
python -m app.scripts.builder_eval --out baseline.json
python -m app.scripts.builder_eval --build anthropic/claude-sonnet-5 --edit anthropic/claude-sonnet-5 --out sonnet.json
```

Five build prompts and five edit prompts on the local driver; reports steps,
typecheck failures, tokens and cost per prompt, and totals. It calls the real
models and costs money.
