export const PROMPT_CHIPS = [
  "An invoicing tool for freelancers",
  "Internal CRM with Slack alerts",
  "Marketplace for studio rentals",
  "Client portal with Stripe billing",
] as const;

export const PROMPT_EXAMPLES = [...PROMPT_CHIPS, "A booking tool for a dental clinic"];

export const PLATFORM_FEATURES = [
  {
    title: "Hosting, handled",
    body: "Deploys, SSL, CDN and backend infrastructure from the first build. Your code and data stay yours.",
    url: "app.vividbuild.dev / deploys",
    label: "Global edge, 14 regions",
    shot: "deploys",
  },
  {
    title: "Your app stack, connected",
    body: "Plug into the tools you already run on, with no integration code to write or keep alive.",
    url: "app.vividbuild.dev / connections",
    label: "38 connectors live",
    shot: "connections",
  },
  {
    title: "Payments, processed",
    body: "Local payment methods, currency conversion and tax compliance across 200+ countries.",
    url: "app.vividbuild.dev / billing",
    label: "Stripe, wired on deploy",
    shot: "billing",
  },
  {
    title: "Safe and secure, as standard",
    body: "Automatic dependency and rules scans, audit logs, and SSO when your team needs it.",
    url: "app.vividbuild.dev / security",
    label: "SOC 2, audit log on",
    shot: "security",
  },
  {
    title: "Works wherever, whenever",
    body: "Build on web, desktop and mobile, or trigger changes from your own tools through the API.",
    url: "app.vividbuild.dev / devices",
    label: "Web, desktop, iOS",
    shot: "devices",
  },
] as const;

export const BUILD_STAGES = [
  {
    title: "Say it the way you'd say it to a person.",
    body: "One paragraph is enough. VividBuild asks the two or three questions that actually change the build, then stops asking.",
    points: [
      "Follow-up questions only where the answer changes architecture",
      "Import a Figma file or a screenshot as the starting point",
      "Bring an existing repo and it builds inside your conventions",
    ],
    file: "prompt.md",
    log: ["> parsing intent", "> 3 clarifying questions queued", "> scope locked: 14 screens"],
    shot: "prompt",
  },
  {
    title: "A plan you can read before code exists.",
    body: "Requirements, data model, and a task list you can reorder or delete. Nothing gets built that isn't on the list.",
    points: [
      "Editable requirements in plain markdown",
      "Data model and API surface diffed on every change",
      "Tasks run in sequence, each one reviewable",
    ],
    file: "spec/checkout-flow.md",
    log: ["> requirements: 22", "> tasks sequenced: 9", "> awaiting approval"],
    shot: "spec",
  },
  {
    title: "Deploy, then keep shipping.",
    body: "Auth, database, file storage, payments and a custom domain on the first deploy. Every later change ships behind a preview URL.",
    points: [
      "Preview environment per change, one click to promote",
      "Rollback to any previous build",
      "Export to GitHub on any paid plan",
    ],
    file: "deploy.log",
    log: ["> build passed in 41s", "> preview: vivid-42.build", "> promoted to production"],
    shot: "ship",
  },
] as const;

/** The simulated run triggered by “Build it →”. `tasks` = spec tasks ticked off, `stage` = active build stage. */
export const BUILD_RUN_STEPS = [
  { log: "> reading intent", tasks: 0, stage: 0 },
  { log: "> 3 clarifying questions queued", tasks: 0, stage: 0 },
  { log: "> requirements written: 22", tasks: 1, stage: 1 },
  { log: "> tasks sequenced: 9", tasks: 2, stage: 1 },
  { log: "> cart + checkout implemented", tasks: 3, stage: 1 },
  { log: "> property tests passing", tasks: 4, stage: 2 },
  { log: "> build passed in 41s", tasks: 5, stage: 2 },
  { log: "> promoted to production", tasks: 5, stage: 2 },
] as const;

export const SPEC_TASKS = [
  { name: "Cart persists across sessions", meta: "done · 3 tests", done: true },
  { name: "Stripe checkout + webhook reconciliation", meta: "done · 7 tests", done: true },
  { name: "Tax rules per region", meta: "running · property tests", done: true },
  { name: "Abandoned-cart email at 4h", meta: "queued", done: false },
  { name: "Admin refund flow with audit log", meta: "queued", done: false },
] as const;

export const SPEC_STATS = [
  { value: "4.1×", label: "fewer re-prompts per feature" },
  { value: "92%", label: "of specs merged unedited" },
] as const;

export const ONCHAIN_POINTS = [
  "Wallet connect and signature auth wired on the first deploy",
  "Contracts arrive with property tests and a written invariant list",
  "Every change ships to an Ark-Konstellation testnet preview before mainnet",
  "Indexed reads, so your app never waits on a full chain scan",
] as const;

export const ONCHAIN_STATS = [
  { value: "0.4s", label: "Block time" },
  { value: "2s", label: "Finality" },
  { value: "EVM", label: "Compatible" },
] as const;

export const COMPARE_ROWS = [
  { feature: "Written spec before code", us: "Always, editable", them: "None, straight to output" },
  { feature: "Tests on generated logic", us: "Property-based + unit", them: "Occasional snapshot" },
  { feature: "Own the code", us: "GitHub export on any paid plan", them: "Locked or never" },
  { feature: "Auth, DB, payments", us: "Wired on first deploy", them: "Copy-paste your own keys" },
  { feature: "Change an old feature", us: "Spec diff, then patch", them: "Regenerates the file" },
  { feature: "Cost at 50 changes", us: "Flat monthly", them: "Per-message credits" },
] as const;

export const LANDING_FAQS = [
  {
    q: "Do I need to know how to code?",
    a: "No. Everything from prompt to deploy is plain language. If you do code, you can open any file, edit it, and VividBuild keeps your changes.",
  },
  {
    q: "Can I use my existing codebase?",
    a: "Yes. Connect a GitHub repo and VividBuild reads your conventions, components and styles, then builds new features inside them.",
  },
  {
    q: "What happens if I cancel?",
    a: "On any paid plan you export the repo and it runs anywhere. There is no proprietary runtime, and the spec files ship with the code. Free projects stay hosted with us until you upgrade.",
  },
  {
    q: "How is this different from a chat that writes code?",
    a: "The spec layer. Requirements and tasks are written, reviewed and diffed, so a change to feature nine doesn't quietly rewrite feature two.",
  },
  {
    q: "Is there a free tier?",
    a: "Yes. Unlimited specs, one live project and a vividbuild.app subdomain. Code export, custom domains and team review start on Pro.",
  },
] as const;
