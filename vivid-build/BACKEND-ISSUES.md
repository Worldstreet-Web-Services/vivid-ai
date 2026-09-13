# Vivid Builder API — issues found integrating a web client

Found while wiring a Next.js client to `https://vivid.tsionark.io` against `llms.txt`.
Ordered by how much they cost the user, not by how hard they look.

Reference project for most of these: `8ff896a0-5736-41c0-ae6f-971e89efcd28`
("A simple recipe box…"), which planned, built, generated images and published
successfully — so the pipeline itself works. Everything below is about what the
client can and cannot see.

---

## 1. A finished turn left no assistant message  ·  bug

**§3 says:** "The assistant message is stored before `[DONE]` is sent, so fetching
messages right after the stream ends is safe."

**What happened:** the build turn for `8ff896a0…` ran to completion — files
written, ten images generated, the app published to a live URL — and
`GET /builder/projects/8ff896a0-5736-41c0-ae6f-971e89efcd28/messages` still ends
on the *user's* `"Build it."`. There is no assistant message for that turn.

The stream was interrupted client-side part-way through (our proxy was
forwarding the browser's abort; we have since stopped doing that for `/chat`).

**Why it matters:** the entire transcript of a 20-minute build is gone —
every tool call, every generated image, the final summary. The user sees their
own message and nothing after it, forever.

**What we'd like:** a cancelled or disconnected turn should still persist
whatever the assistant produced up to that point. If that is already the
intent, something is not firing on the disconnect path.

**Related question:** when the client disconnects from the SSE stream, is the
turn cancelled server-side? In our case the work clearly *continued* (the app
was built and published) but nothing was stored — which is the worst of both
outcomes. Whichever is intended, the other half should match it.

---

## 2. No way to know a turn is running  ·  missing capability

**Ask:**

```diff
 Project {
   …
+  turn_status: "idle" | "running",
+  turn_started_at: string | null,
 }
```

**Today** a client can only *infer* it: "the last message is a user message with
no reply". That inference is a guess, and issue #1 is exactly the case where it
is wrong — it will wait forever for a reply that is never coming. We currently
poll `GET /messages` every 5s and give up after 30 minutes.

**What the field unlocks:**

- **"Building…" on a project card**, without opening the project. Right now the
  projects list cannot distinguish a project mid-build from an idle one.
- **Correct composer state on load.** Today the only way to discover a turn is
  running is to send a message and eat a `409 busy`.
- **An honest progress state** when someone returns to a tab they left.

`turn_started_at` matters too: "building for 6 minutes" is reassuring in a way
that a bare spinner is not, given first builds run 15–25 minutes.

**Observed since:** with no such field, a turn that ends *without persisting an
assistant message* (issue #1) traps the client. Our "is a turn running?"
inference — "the last message is a user message with no reply" — stays true
forever, so the "Still working on this" banner never clears and the composer
stays disabled. The user's words: *"it seems to have finished but because I left
it's stuck here… and I can't stop it."*

The only escape the API offers is `POST /cancel`, whose `{cancelled: false}`
answer means "nothing was running". We now use that reply as the de-facto
turn-status check and clear the banner on it. That works, but it means the only
way to ask *"is a turn running?"* is to call the endpoint whose job is to stop
one — which is fine for us and would be a poor thing for anyone else to copy.

**Nice to have alongside it:** a resumable stream
(`GET /builder/projects/{id}/chat/stream`, or reconnect support on the existing
route). Reloading mid-build currently loses all live activity — the folded
message does arrive at the end, but the 20 minutes in between are blank.

---

## 3. CORS: please allow-list our origins  ·  config

Verified:

```
GET  /v1/health                Origin: http://localhost:3001
  -> 200, access-control-allow-credentials: true
         access-control-expose-headers: X-Request-Id
     (no access-control-allow-origin)

OPTIONS /v1/builder/projects   Origin: http://localhost:3001
  -> access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
     access-control-max-age: 600
     vary: Origin
```

`vary: Origin` + `allow-credentials` + a populated `allow-methods` means the
middleware and its allow-list exist — we are simply not on it. A browser
`fetch` from our origin fails with `TypeError: Failed to fetch`.

**Consequence:** every call, including the 15–25 minute SSE chat stream, is
relayed through a same-origin server route. That works locally but is a real
problem on any serverless host, where the response cap (300s–900s) is far below
a first build. It also means we own a set of header rules (stripping
`content-encoding`, forcing `no-transform`) whose only job is to stop the stream
being buffered or corrupted in transit.

**Ask:** add the app's origins to the allow-list. One config line, and the
browser talks to `/chat` directly.

---

## 4. `Project.thumbnail_url`  ·  missing capability, cheap

The critique step already renders desktop and mobile screenshots and returns
them on `data-critique` with 7-day signed URLs. Exposing the most recent desktop
one on the project row would turn the projects grid from placeholder gradients
into actual screenshots of the apps.

The alternatives available to a client today are both bad: iframing the live
preview per card would boot one cloud sandbox per card (5–60s each, and it
costs money), and digging the URL out of the last assistant message costs one
`GET /messages` per card.

---

## 5. Binary files come back as text  ·  bug

`GET /builder/projects/{id}/files/{path}` returns `{path, content}` as JSON for
**every** file, so `public/uploads/akara.jpg` arrives as a UTF-8 decode of JPEG
bytes. Rendered, it is several thousand replacement characters.

**Ask:** either

```diff
 { path, content, +binary: true, +content_base64: "…" }
```

or a content-type-aware raw variant (`?raw=1`) that serves the actual bytes.

**Workaround in place:** we never fetch known-binary extensions, and cross-
reference the assets list to find a real URL for images. That only works for
files that also happen to be assets — a binary the agent writes that is not an
asset has no preview at all.

---

## 6. `POST /keys` is referenced but never specified  ·  docs

§0 says a `vivid_` API key works on every `/v1` route and can be created with
`POST /keys` given a session. No section defines the request or response shape,
and it does not appear in the endpoint list. Our API-keys settings page is
currently a "not available yet" placeholder.

---

## 7. Supabase OAuth is not configured on this deployment  ·  config

`GET /v1/health` reports `builder.supabase_oauth: false`, so
`GET /connectors/supabase/authorize` answers `503 not_configured` and the
"Connect Supabase" button cannot work. §9's fallback (pasting a personal access
token) is implemented and does work — flagging only in case the OAuth app was
meant to be live here.

---

## 8. A malformed tool call is swallowed, and the turn builds on the gap  ·  bug

Reference project: `48ca968e-562f-4dd2-881d-899077b341c5` ("Internal CRM").

**What happened:** one `write_file` call — for `src/components/DealDialog.tsx` —
came back errored with *"arguments were not valid JSON"*. The turn then ran
about fifteen more steps, importing and wiring a file that had never been
written, and ended on `data-usage.reason: "typecheck_strikes"` with the agent's
own closing line: *"I could not get the code to typecheck cleanly this turn."*

The dev server confirms the shape of it — the preview is a wall of
`Failed to resolve import "@/pages/Settings"` from `src/App.tsx`.

**Why it matters:** the malformed call is the root cause, and it is knowable at
the instant it happens. Everything after it is wasted: ~15 steps of model time,
a sandbox held open, and a build the user is told to wait 20 minutes for that
could not have succeeded. The user then sees a mostly-working app with dead
links and no indication of which single file is missing.

**Ask, in order of preference:**

1. **Retry the call.** A JSON-arguments failure is the case most likely to
   succeed on a second attempt with the same intent.
2. **Failing that, fail loudly** — surface it as a turn-level error rather than
   one errored tool part among twenty-five, so a client can show it.
3. **At minimum, name it in `data-usage`.** `reason: "typecheck_strikes"` is the
   symptom; `"invalid_tool_arguments"` (or a `failed_tools: ["write_file"]`
   list) would let the client say *which file never got written*, which is the
   one fact that makes the failure actionable.

---

## 9. `data-usage.reason` has no way to say "this went fine"  ·  docs / small API change

§3 documents `data-usage` but never lists the values `reason` can take. We built
the obvious thing — treat anything other than `"answered"` as a problem worth
surfacing — and it was wrong twice on the very first planning turn:

| reason | what actually happened | what we showed |
|---|---|---|
| `asked` | the agent asked the user a question — plan mode working | "This turn stopped early. **Ask it to finish**" |
| `spec_written` | the spec was produced — plan mode finished | "This turn stopped early. **Ask it to finish**" |

Both were rendered directly beneath the question card and the spec card the same
turn had just produced, so the UI contradicted itself on screen.

**Ask:** either publish the closed set of values and mark which are terminal
successes, or add a boolean the client can branch on:

```diff
 data-usage: {
   model, steps, reason,
+  ok: true,          // the turn ended the way it meant to
 }
```

We have worked around it by warning only on the four reasons we recognise as
failures (`typecheck_strikes`, `step_limit`, `cancelled`, `error`) and staying
quiet on everything else — which means a *new* failure reason will now go
unannounced until we learn its name. The flag would fix that properly.

---

## 10. `/auth/refresh` and a stale bearer  ·  needs confirming

Access tokens last 30 minutes (§0). On expiry we call
`POST /auth/refresh {refresh_token}`. We were also sending
`Authorization: Bearer <the expired access token>` on that request, and the
session did not renew — the user was dropped on the sign-in modal roughly 30
minutes into a session.

We have stopped sending the header, since §0 does not ask for it.

**Ask:** confirm the intended behaviour. If `/auth/refresh` rejects a request
carrying an expired bearer before reading the body, that is worth one line in
§0 — it is an easy mistake for a client to make, because every *other* route
requires the header and the natural thing is to attach it everywhere.

Related: a `401` from `/auth/refresh` means "sign in again", but we cannot tell
that apart from a `500` or a gateway error without guessing from the status. We
now only clear the session on `401`/`403`. A documented error `code` on this
route (`refresh_expired`, say) would make that explicit rather than inferred.

---

## 11. Google Maps and the full-stack flag were easy to miss  ·  docs

Not a bug, but a note on discoverability, since both cost us a rebuild:

- `Project.maps_provider` and `POST/DELETE /builder/projects/{id}/maps` are in
  §9 under a heading that reads as being about Supabase and Paystack. We had
  wired every other endpoint and still shipped a UI with no Google Maps at all.
- The "Full-stack app" toggle (`PATCH {fullstack}`) is specified in §4, in prose,
  in the middle of the plan-mode narrative, rather than with the other project
  fields. Same outcome: implemented last.

**Ask:** an endpoint index at the top of `llms.txt` — one line per route — would
have caught both. The per-section detail is excellent; what is missing is the
checklist a client can diff against.

---

## 12. A build turn read six files, wrote nothing, and reported success  ·  bug

Reference project: `ee274753-5abd-4483-9b3c-21b6af0b2564`
("A delivery tracking page for a Lagos courier"). This is the most expensive
failure we have seen, because nothing about it looks like a failure.

**What happened.** Plan mode worked perfectly: brief, five questions, spec,
`fullstack: true` set correctly from the answers. `POST /build` flipped the
mode, the first build turn went in, and the stream produced:

```
text        "I'll start by reading the files I'm about to touch.\n\n\n\n\n\n\n\n"
tool-read_file  index.html                    output-available
tool-read_file  src/index.css                 output-available
tool-read_file  src/lib/supabase.ts           output-available
tool-read_file  src/components/ui/button.tsx  output-available
tool-read_file  src/components/ui/badge.tsx   output-available
tool-read_file  src/components/ui/input.tsx   output-available
step-start      (step 2)
data-usage  {model: "deepseek/deepseek-v4.1-flash", steps: 2,
             reason: "answered", tokens_in: 22703, tokens_out: 9646}
```

Then it ended. **No `write_file`. No error. `reason: "answered"`.** The preview
still shows the "Your app starts here" placeholder, and a snapshot was taken and
labelled version 1 — of a project in which nothing was built.

**The two things that make this bad:**

1. **`reason: "answered"` on a turn that produced nothing.** Every signal the
   API gives a client says this turn succeeded. We had to infer the failure by
   checking whether the turn called any file-writing tool at all, which is not
   something a client should have to do.
2. **`tokens_out: 9646` for one sentence of visible text.** Nine and a half
   thousand output tokens were generated and discarded. The visible text ends in
   eight blank newlines. That reads like the model emitted the file contents as
   prose or as tool calls that failed to parse, and the result was dropped
   silently — the same shape as issue #8, which is why we suspect they are the
   same underlying problem.

**Also worth a look:** the model on this turn was
`deepseek/deepseek-v4.1-flash`. A flash model was picked for a full first build
of a multi-page app with maps and auth. If model selection is automatic, a first
build seems like the wrong place to economise — and if the flash model is what
produced the malformed output above, that is the whole explanation.

**Ask:**

- A turn that called no file-writing tool must not report `reason: "answered"`.
  Anything else — `no_output`, `tool_parse_failed`, even `error` — lets a client
  tell the user the truth.
- Do not take a snapshot for a turn that changed no files. "Saved as version 1"
  on an empty project is actively misleading.
- If tool arguments failed to parse (the `tokens_out` figure suggests they did),
  surface that; see issue #8.

**Workaround in place:** we now treat a build-mode turn that called tools but
none that write, run or generate as a failure, and show "This turn read the
project but did not change any files" with an "Ask it to build" button. It is a
heuristic standing in for a status the API should report.

---

## Small notes, no action needed

- **§3's part list mixes wire and folded names.** `tool-input-available`,
  `tool-output-available` and `start-step` are wire frames; what `useChat` and
  `GET /messages` actually hold are `tool-<name>` with a `state` field, and
  `step-start`. A note in the guide would save the next integrator an hour.
- **`POST /build` does not start a turn.** It flips `mode` to `"build"` and
  returns; the first build turn still has to be sent as a chat message. §1's
  numbered lifecycle reads as though it starts one. Worth one clarifying
  sentence.
- **The brief arrives twice** — as streamed `text` parts and again in
  `data-brief` (§4 does say so). Rendering both shows the same paragraphs
  twice; we render only the streamed copy.
- **`current_snapshot_id` stays `null` on a project that has built and
  published.** `48077a0a-3ead-4905-aab0-d61fa2d9bb58` has a live URL and a
  populated `spec_md`, and still reports `current_snapshot_id: null`. We do not
  rely on the field, so this is only a heads-up in case something else does.
- **`POST /connectors` errors are excellent.** A deliberately bad Google Maps
  key came back `422 invalid_request` carrying Google's own sentence —
  *"Google rejected the key: The provided API key is invalid."* We show it
  verbatim. More endpoints answering like this would be welcome.
- **§6's `vivid:error` snippet has no origin check.** As written, any page could
  post a fake error to the parent and have its text shown to the user — and in
  our UI, put into a chat turn. We validate `event.origin` against the preview
  URL; worth adding to the snippet.
