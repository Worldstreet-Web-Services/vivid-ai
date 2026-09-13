import type { ReactNode } from "react";
import { ConnectorLogo } from "@/components/brand/connector-logo";
import { cn } from "@/lib/cn";

export type ShotKind =
  | "deploys"
  | "connections"
  | "billing"
  | "security"
  | "devices"
  | "prompt"
  | "spec"
  | "ship"
  | "chain";

const LABELS: Record<ShotKind, string> = {
  deploys: "Deployments list with production and preview builds",
  connections: "Connected services for a project",
  billing: "Revenue chart and recent payments",
  security: "Security scan results and audit log",
  devices: "The same project open on desktop and phone",
  prompt: "A plain-language prompt with clarifying questions",
  spec: "A spec file with requirements and a diff",
  ship: "A preview build ready to promote, with version history",
  chain: "A deployed contract with recent transactions",
};

/** Product UI drawn with theme tokens, standing in for screenshots. Follows light and dark themes. */
export function ProductShot({
  kind,
  className,
  ariaHidden,
}: {
  kind: ShotKind;
  className?: string;
  ariaHidden?: boolean;
}) {
  const Shot = SHOTS[kind];
  return (
    <div
      role="img"
      aria-label={LABELS[kind]}
      aria-hidden={ariaHidden || undefined}
      className={cn(
        "absolute inset-0 overflow-hidden bg-surface p-[clamp(14px,2vw,22px)] text-[11px] leading-snug text-fg-2 select-none",
        className,
      )}
    >
      <Shot />
    </div>
  );
}

function Dot({ on = true }: { on?: boolean }) {
  return <span className={cn("block size-1.5 flex-none rounded-full", on ? "bg-accent" : "bg-line-3")} />;
}

function Title({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-bold tracking-[-0.02em] text-fg">{children}</span>
      {meta && <span className="rounded-full border border-line-2 px-2 py-0.5 font-semibold text-muted-2">{meta}</span>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line-2 bg-surface-2 px-2.5 py-2">
      <p className="text-[10px] font-semibold text-muted-2">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold tracking-[-0.03em] text-fg">{value}</p>
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y divide-line rounded-xl border border-line-2 bg-surface-2">{children}</ul>;
}

const DEPLOYS = [
  { id: "#128", note: "Tax rules per region", env: "Production", ago: "2m", live: true },
  { id: "#127", note: "Admin refund flow", env: "Preview", ago: "1h", live: true },
  { id: "#126", note: "Abandoned-cart email", env: "Production", ago: "3h", live: true },
  { id: "#125", note: "Cart persists across sessions", env: "Rolled back", ago: "1d", live: false },
];

function DeploysShot() {
  return (
    <div className="flex flex-col gap-3">
      <Title meta="storefront">Deployments</Title>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Status" value="Healthy" />
        <Stat label="Last build" value="41s" />
        <Stat label="SSL" value="Active" />
      </div>
      <Rows>
        {DEPLOYS.map((deploy) => (
          <li key={deploy.id} className="flex items-center gap-2.5 px-3 py-2.5">
            <Dot on={deploy.live} />
            <span className="w-8 flex-none font-semibold text-muted-2">{deploy.id}</span>
            <span className="min-w-0 flex-1 truncate text-fg">{deploy.note}</span>
            <span className="flex-none text-muted-2">{deploy.env}</span>
            <span className="w-6 flex-none text-right text-muted-3">{deploy.ago}</span>
          </li>
        ))}
      </Rows>
    </div>
  );
}

const CONNECTIONS = [
  { id: "stripe", name: "Stripe", category: "Payments", on: true },
  { id: "supabase", name: "Supabase", category: "Data", on: true },
  { id: "clerk", name: "Clerk", category: "Auth", on: true },
  { id: "resend", name: "Resend", category: "Comms", on: true },
  { id: "cloudinary", name: "Cloudinary", category: "Storage", on: true },
  { id: "discord", name: "Discord", category: "Comms", on: false },
  { id: "linear", name: "Linear", category: "Productivity", on: false },
  { id: "notion", name: "Notion", category: "Productivity", on: false },
];

function ConnectionsShot() {
  return (
    <div className="flex flex-col gap-3">
      <Title meta="5 connected">Connections</Title>
      <ul className="grid grid-cols-2 gap-2">
        {CONNECTIONS.map((connector) => (
          <li
            key={connector.id}
            className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-surface-2 px-2.5 py-2"
          >
            <ConnectorLogo id={connector.id} name={connector.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-fg">{connector.name}</span>
              <span className="block truncate text-[10px] text-muted-2">{connector.category}</span>
            </span>
            <span
              className={cn(
                "flex h-3.5 w-6 flex-none items-center rounded-full p-0.5",
                connector.on ? "justify-end bg-accent" : "justify-start bg-line-3",
              )}
            >
              <span className="block size-2.5 rounded-full bg-surface" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const REVENUE_BARS = [34, 42, 38, 51, 47, 58, 55, 63, 60, 72, 68, 79, 74, 88];
const PAYMENTS = [
  { order: "Order #4821", detail: "EUR → USD", amount: "€129.00" },
  { order: "Order #4820", detail: "Paystack · NGN", amount: "₦86,500" },
  { order: "Order #4819", detail: "VAT 20% applied", amount: "£54.00" },
];

function BillingShot() {
  return (
    <div className="flex flex-col gap-3">
      <Title meta="Last 14 days">Revenue</Title>
      <div className="rounded-xl border border-line-2 bg-surface-2 p-3">
        <p className="text-xl font-extrabold tracking-[-0.03em] text-fg">$18,420</p>
        <div className="mt-2 flex h-16 items-end gap-1">
          {REVENUE_BARS.map((height, i) => (
            <span
              key={i}
              className={cn("block flex-1 rounded-sm", i === REVENUE_BARS.length - 1 ? "bg-accent" : "bg-line-3")}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
      <Rows>
        {PAYMENTS.map((payment) => (
          <li key={payment.order} className="flex items-center gap-2.5 px-3 py-2.5">
            <Dot />
            <span className="font-semibold text-fg">{payment.order}</span>
            <span className="min-w-0 flex-1 truncate text-muted-2">{payment.detail}</span>
            <span className="flex-none font-semibold text-fg">{payment.amount}</span>
          </li>
        ))}
      </Rows>
    </div>
  );
}

const SCANS = [
  { name: "Dependencies", result: "0 critical" },
  { name: "Access rules", result: "12 checked" },
  { name: "Secrets", result: "None exposed" },
];
const AUDIT = [
  { time: "14:02", entry: "ada@studio promoted build #128" },
  { time: "13:47", entry: "SSO enforced for workspace" },
  { time: "11:30", entry: "API key rotated: deploy-bot" },
];

function SecurityShot() {
  return (
    <div className="flex flex-col gap-3">
      <Title meta="Passed">Security scan</Title>
      <div className="grid grid-cols-3 gap-2">
        {SCANS.map((scan) => (
          <Stat key={scan.name} label={scan.name} value={scan.result} />
        ))}
      </div>
      <p className="mt-1 text-[10px] font-semibold tracking-[0.08em] text-muted-2 uppercase">Audit log</p>
      <Rows>
        {AUDIT.map((item) => (
          <li key={item.entry} className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex-none font-semibold text-muted-3">{item.time}</span>
            <span className="min-w-0 flex-1 truncate text-fg">{item.entry}</span>
          </li>
        ))}
      </Rows>
    </div>
  );
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="block h-1.5 rounded-full bg-line-2" style={{ width: `${90 - i * 17}%` }} />
      ))}
    </div>
  );
}

function DevicesShot() {
  return (
    <div className="flex h-full flex-col gap-3">
      <Title meta="Synced">Everywhere</Title>
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 right-[22%] overflow-hidden rounded-xl border border-line-3 bg-surface-2">
          <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="block size-1.5 rounded-full bg-line-3" />
            ))}
          </div>
          <div className="grid grid-cols-[30%_1fr] gap-2.5 p-2.5">
            <Skeleton lines={4} />
            <div className="flex flex-col gap-2">
              <div className="h-10 rounded-lg border border-line-2 bg-surface" />
              <Skeleton lines={3} />
            </div>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 flex h-[82%] w-[30%] flex-col gap-2 rounded-[14px] border border-line-3 bg-surface p-2 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]">
          <span className="mx-auto block h-1 w-6 rounded-full bg-line-3" />
          <div className="h-8 rounded-md border border-line-2 bg-surface-2" />
          <Skeleton lines={4} />
        </div>
      </div>
      <p className="truncate rounded-lg border border-line-2 bg-surface-2 px-2.5 py-1.5 font-semibold text-muted-2">
        POST /v1/projects/storefront/changes
      </p>
    </div>
  );
}

function PromptShot() {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="ml-auto max-w-[88%] rounded-xl rounded-br-sm border border-line-2 bg-surface-2 px-3 py-2 text-fg">
        A shop for my ceramics studio. People buy pieces, book wheel classes, and I get a Slack ping for each order.
      </p>
      <div className="max-w-[92%] rounded-xl rounded-bl-sm border border-line-2 px-3 py-2">
        <p className="font-semibold text-fg">3 questions before I plan:</p>
        <p className="mt-1.5 text-muted">Do classes need deposits?</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-btn-fg">Yes, 50%</span>
          <span className="rounded-full border border-line-3 px-2 py-0.5">No</span>
        </div>
      </div>
    </div>
  );
}

function SpecShot() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-bold text-fg"># Checkout flow</p>
      <p className="font-semibold text-muted-2">## Requirements</p>
      <p>R1 · Cart persists across sessions</p>
      <p>R2 · Stripe checkout with webhook reconciliation</p>
      <div className="mt-1 overflow-hidden rounded-lg border border-line-2">
        <p className="bg-surface-2 px-2.5 py-1 text-muted-3 line-through">- R3 · Flat 10% tax on every order</p>
        <p className="bg-tint px-2.5 py-1 font-semibold text-fg">+ R3 · Tax rules per region (EU VAT, US sales tax)</p>
      </div>
    </div>
  );
}

const VERSIONS = [
  { id: "v42", note: "Preview · tax rules", current: false },
  { id: "v41", note: "Production", current: true },
  { id: "v40", note: "Abandoned-cart email", current: false },
];

function ShipShot() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-surface-2 px-3 py-2">
        <Dot />
        <span className="min-w-0 flex-1 truncate font-semibold text-fg">vivid-42.build</span>
        <span className="rounded-full bg-btn px-2.5 py-0.5 font-bold text-btn-fg">Promote</span>
      </div>
      <Rows>
        {VERSIONS.map((version) => (
          <li key={version.id} className="flex items-center gap-2.5 px-3 py-1.5">
            <span className="w-7 font-semibold text-muted-2">{version.id}</span>
            <span className="min-w-0 flex-1 truncate">{version.note}</span>
            <span className={cn("font-semibold", version.current ? "text-fg" : "text-muted-3")}>
              {version.current ? "Live" : "Roll back"}
            </span>
          </li>
        ))}
      </Rows>
    </div>
  );
}

const TRANSACTIONS = [
  { block: "#8,412,907", call: "mintPass()", from: "0x7a3f…c91e" },
  { block: "#8,412,884", call: "redeem()", from: "0x19bd…04a2" },
  { block: "#8,412,851", call: "mintPass()", from: "0xe02c…7f13" },
];

function ChainShot() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="font-bold text-fg">StudioPass.sol</span>
        <span className="min-w-0 flex-1 truncate text-muted-2">0x4c8e…a17b</span>
        <span className="flex-none rounded-full border border-line-3 px-2 py-0.5 font-semibold">6/6 invariants hold</span>
      </div>
      <Rows>
        {TRANSACTIONS.map((tx) => (
          <li key={tx.block} className="flex items-center gap-2.5 px-3 py-1.5">
            <Dot />
            <span className="w-[74px] flex-none font-semibold text-muted-2">{tx.block}</span>
            <span className="min-w-0 flex-1 truncate text-fg">{tx.call}</span>
            <span className="flex-none text-muted-3">{tx.from}</span>
          </li>
        ))}
      </Rows>
    </div>
  );
}

const SHOTS: Record<ShotKind, () => ReactNode> = {
  deploys: DeploysShot,
  connections: ConnectionsShot,
  billing: BillingShot,
  security: SecurityShot,
  devices: DevicesShot,
  prompt: PromptShot,
  spec: SpecShot,
  ship: ShipShot,
  chain: ChainShot,
};
