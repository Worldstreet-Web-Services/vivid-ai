# Frontend Architecture

How this frontend is structured and why. Read it before adding a directory, a
transport, or a shared component.

This app shares its architecture with the Worldstreet frontend
(`wsws-frontend`). The two sit under one company, so the layering, the transport
shape, the design tokens and the review bar are deliberately the same. A change
that would be rejected there is rejected here.

- `.claude/skills/wsws-engineering-standards/SKILL.md` is the coding bar.
- `README.md` is setup and scripts.

---

## 1. The rule

Four layers. Every import points downward. That is the whole model.

```
app/                routes and BFF handlers. Composes features, owns no logic.
   |  may import
components/layout/  the app shell. The one place below app/ that composes features.
   |  may import
features/           vertical slices. Never import a sibling.
   |  may import
components/ui/      design system primitives. Know nothing about any feature.
hooks/              cross-cutting React hooks. Same rule, same layer.
   |  may import
lib/                pure cross-cutting: api client, format, utils.
```

`components/ui/` and `hooks/` are siblings on the shared layer: one holds
presentation primitives, the other behaviour every feature needs. `lib/` sits
below both and stays framework-free, which is why a hook cannot live there.

### Four consequences

1. **Features never import each other, not even through the index.** They are
   siblings; the route composes them. See [section 4](#4-composing-across-features).
2. **`lib/` is for what two or more features need.** If only chat uses it, it
   belongs in `features/chat/lib/`.
3. **A hook belongs in `hooks/` when it is generic behaviour, not when it has
   many callers.** `useDebouncedValue` lives there with one caller, because
   nothing about it is tied to the feature that happens to use it.
4. **Anything a route handler needs belongs in `lib/server/`.** Importing a
   slice barrel into a route handler drags client components into the server
   bundle. The lint rules allow it, so this one is on you.

### Deciding where a component belongs

Judge membership of `components/ui/` by whether the component knows anything
about a feature, not by how many places import it. A `Switch` is a primitive
even if used once. A composer that understands prompts and models is a feature
component.

---

## 2. Structure

```
app/                    routes and BFF only
  api/                  one folder per upstream path
  layout.tsx  providers.tsx  globals.css

features/               vertical slices. Each owns its whole vertical.
  <slice>/
    components/
    hooks/
    lib/                pure, unit tested
    index.ts            the only thing outside may import

components/
  ui/                   design system
  layout/               app-shell, sidebar, topbar, nav-items

hooks/                  generic cross-cutting hooks
lib/                    cross-cutting only
  api.ts                apiFetch
  api/                  envelope.ts, service.ts, schemas/
  server/               server only. A client import must fail.
  format.ts  utils.ts

config/                 app metadata
docs/                   this file
```

Tests sit beside the code they cover and take its name, so `suggestions.ts` is
covered by `suggestions.test.ts` in the same folder and a slice can be read,
moved, or deleted with its tests attached.

---

## 3. Data flow

```
component -> hook (TanStack Query) -> feature lib client -> app/api/<path> -> FastAPI
```

- A component never calls `fetch` directly and never holds a base URL.
- Every upstream call goes through a route handler in `app/api/`. The handler
  holds the base URL, and any future secret, and validates the response.
- `VIVID_API_BASE_URL` is server-side only. It is deliberately not a
  `NEXT_PUBLIC_` variable. If a key would end up in one, the design is wrong.
- One transport. `createServiceClient(basePath, fallbackMessage)` in
  `lib/api/service.ts` defines a service by those two facts. Do not write
  another wrapper.
- The backend speaks plain JSON. The route handler puts the
  `{ success, data | error }` envelope on and `lib/api/envelope.ts` takes it off,
  so every feature fails the same way and a component never sees a raw upstream
  shape. That normalisation happens at the same boundary as validation, which is
  the point of having a boundary.
- Upstream payloads are validated by a Zod schema in `lib/api/schemas/` before
  they leave `lib/server/upstream.ts`. Validation failures log the reason and
  return `BAD_RESPONSE`; the schema internals never reach the browser.
- Pure derivation and formatting live in a `lib/` file with tests. Components
  render, hooks orchestrate.

---

## 4. Composing across features

A feature may not import another feature. When one feature's view has to show
another's, the route composes them. Which pattern depends on who owns the state.

**Static child: pass a slot.** The chat launcher shows the backend status, and
neither owns the other's state:

```tsx
// app/page.tsx
<ChatLauncher statusSlot={<BackendStatus />} />
```

**The feature triggers, the route owns the modal: raise a callback.** The
feature raises `onOpenThing(payload)` and the route renders the sheet.

**The feature owns the state and is too large to safely reshape: take a render
prop.** Prefer the first two.

If two slices keep reaching for each other, that is evidence they are one
feature. Merging them is the correct response.

---

## 5. Conventions

**Feature public surface.** Each slice exports only what others may use:

```ts
// features/system/index.ts
export { BackendStatus } from "./components/backend-status";
export { useHealth, healthQueryKey } from "./hooks/use-health";
```

**Naming.** Files are kebab-case. Components are PascalCase and named for what
they are. Hooks are `use<Thing>`. A pure module is named for its domain, not its
shape: `suggestions.ts`, `format.ts`, never `helpers.ts`.

**Variants.** Primitives take a `variant`/`size` prop, mirror it onto a
`data-*` attribute, and look the value up in a plain record. There is no
`class-variance-authority` here, matching the sibling repo.

**Size.** A component over roughly 300 lines is usually holding three jobs:
server state, derivation, and layout. Extract the first two.

**Server components.** Default to server. Reach for `"use client"` only for
interactivity, browser APIs, or client state, and push the boundary as deep as
possible.

---

## 6. Enforcement

Structure that is not enforced decays. These are the mechanisms.

**`eslint-plugin-boundaries`** in `eslint.config.mjs` types every folder and
runs two policies: a feature may not import another feature, and `lib`,
`components/ui`, `hooks` and the rest of `components/` may not import upward
into `features`, `app` or `layout`. A violation fails `pnpm lint`.

One trap if you edit that config: element patterns match partially by default,
so `lib/**` also matches the `lib/` folder inside a slice and misattributes
errors until every descriptor sets `partialMatch: false`.

**The five gates**, in the order CI runs them: `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build`. Typecheck is separate from build
because `next build` only checks what the build graph reaches.

**Adding a top-level directory means editing `app/globals.css`.** Tailwind runs
with `source(none)`, so it scans only the directories listed in the `@source`
lines. A class used only in an unlisted directory is dropped from the stylesheet
with no error and no warning: the component renders unstyled while typecheck,
lint, tests and the build all stay green.

---

## 7. What is left

The scaffold is in place. None of the following blocks work.

- [ ] **Screens beyond the launcher.** The Figma reference covers threads,
      sources, Spaces, Computer, artifacts, history, generation, sharing and
      settings. Each becomes a slice as its backend endpoint lands.
- [ ] **Auth.** `apiFetch` has the seam for it and takes no tokens today.
- [ ] **Playwright specs** against a preview deployment, once there are flows
      worth driving end to end.

---

## 8. Open decisions

Recorded so they are chosen rather than defaulted into.

1. **The backend is one endpoint.** `GET /api/health` is all `vivid-backend`
   exposes. Every other screen in the Figma reference has no data behind it yet.
   Current position: build the shell and the primitives, and add a slice when
   its endpoint exists rather than mocking one.
2. **i18n.** The sibling repo runs `next-intl` across five locales. This app
   does not, because nothing has asked for a second locale yet. Adding it later
   is a wrapper in `next.config.ts` and a `messages/` directory, not a rewrite,
   so it is deliberately deferred.
3. **Route groups.** Not used. Every page inherits `AppShell` from the root
   layout. If a marketing surface arrives that must not carry the shell, that is
   the point to introduce `(app)` and `(marketing)`.
