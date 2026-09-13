import {
  siAirtable,
  siBitbucket,
  siClaude,
  siClerk,
  siCloudinary,
  siDiscord,
  siElevenlabs,
  siGithub,
  siGitlab,
  siGoogle,
  siGooglecalendar,
  siGooglemaps,
  siGooglesheets,
  siHubspot,
  siLemonsqueezy,
  siLinear,
  siNotion,
  siOkta,
  siPaypal,
  siPostgresql,
  siResend,
  siStripe,
  siSupabase,
  siTelegram,
  siWalletconnect,
  type SimpleIcon,
} from "simple-icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Brand marks from Simple Icons, keyed by connector id (see lib/connectors.ts) plus the Git hosts,
 * sign-in providers and messaging apps used in settings. Brands it no longer carries are drawn in
 * DRAWN below, or fall back to a brand-tinted monogram.
 */
const ICONS: Partial<Record<string, SimpleIcon>> = {
  google: siGoogle,
  "google-auth": siGoogle,
  github: siGithub,
  "github-auth": siGithub,
  gitlab: siGitlab,
  bitbucket: siBitbucket,
  telegram: siTelegram,
  okta: siOkta,
  clerk: siClerk,
  stripe: siStripe,
  paypal: siPaypal,
  "lemon-squeezy": siLemonsqueezy,
  postgres: siPostgresql,
  supabase: siSupabase,
  airtable: siAirtable,
  "google-sheets": siGooglesheets,
  resend: siResend,
  discord: siDiscord,
  notion: siNotion,
  linear: siLinear,
  "google-calendar": siGooglecalendar,
  "google-maps": siGooglemaps,
  hubspot: siHubspot,
  anthropic: siClaude,
  elevenlabs: siElevenlabs,
  cloudinary: siCloudinary,
  walletconnect: siWalletconnect,
};

/**
 * Simple Icons dropped a number of marks over trademark policy, so the brands below are drawn here
 * from their basic geometry. Only shapes that can be reproduced faithfully get a mark; the rest take
 * a brand-tinted monogram tile, which still reads as "that company" in a list.
 */
const DRAWN: Partial<Record<string, { hex: string; mark: ReactNode }>> = {
  paystack: {
    hex: "00C3F7",
    // Four stacked bars, the last one short — Paystack's mark.
    mark: (
      <g fill="currentColor">
        <rect x="2" y="3" width="20" height="3.6" rx="1" />
        <rect x="2" y="8.3" width="20" height="3.6" rx="1" />
        <rect x="2" y="13.6" width="20" height="3.6" rx="1" />
        <rect x="2" y="18.9" width="12" height="3.6" rx="1" />
      </g>
    ),
  },
  twilio: {
    hex: "F22F46",
    mark: (
      <g fill="currentColor">
        <path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm0 3.4a7.1 7.1 0 1 1 0 14.2 7.1 7.1 0 0 1 0-14.2Z" />
        <circle cx="9.4" cy="9.4" r="1.9" />
        <circle cx="14.6" cy="9.4" r="1.9" />
        <circle cx="9.4" cy="14.6" r="1.9" />
        <circle cx="14.6" cy="14.6" r="1.9" />
      </g>
    ),
  },
  slack: {
    hex: "E01E5A",
    // The four-arm pinwheel, in Slack's four colours.
    mark: (
      <g>
        <path
          fill="#36C5F0"
          d="M9 2.4a2.4 2.4 0 0 0 0 4.8h2.4V4.8A2.4 2.4 0 0 0 9 2.4Zm0 6.4H2.6a2.4 2.4 0 0 0 0 4.8H9a2.4 2.4 0 1 0 0-4.8Z"
        />
        <path
          fill="#2EB67D"
          d="M21.6 11.2a2.4 2.4 0 0 0-4.8 0v2.4h2.4a2.4 2.4 0 0 0 2.4-2.4Zm-6.4 0V4.8a2.4 2.4 0 0 0-4.8 0v6.4a2.4 2.4 0 0 0 4.8 0Z"
        />
        <path
          fill="#ECB22E"
          d="M15 21.6a2.4 2.4 0 0 0 0-4.8h-2.4v2.4a2.4 2.4 0 0 0 2.4 2.4Zm0-6.4h6.4a2.4 2.4 0 0 0 0-4.8H15a2.4 2.4 0 0 0 0 4.8Z"
        />
        <path
          fill="#E01E5A"
          d="M2.4 12.8a2.4 2.4 0 0 0 4.8 0v-2.4H4.8a2.4 2.4 0 0 0-2.4 2.4Zm6.4 0v6.4a2.4 2.4 0 0 0 4.8 0v-6.4a2.4 2.4 0 0 0-4.8 0Z"
        />
      </g>
    ),
  },
  "the-graph": {
    hex: "6747ED",
    mark: (
      <g fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="10" cy="9.5" r="5.5" />
        <path strokeLinecap="round" d="m13.6 14 5 5.6" />
        <circle cx="18.8" cy="5.4" r="2.1" fill="currentColor" stroke="none" />
      </g>
    ),
  },
  uploadthing: {
    hex: "E91515",
    mark: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5" />
        <path d="M3.5 15v3.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V15" />
      </g>
    ),
  },
};

/** Brands with no drawable mark still get their own colour, so the tile is never anonymous. */
const TINTS: Partial<Record<string, string>> = {
  openai: "10A37F",
  s3: "569A31",
  "ark-konstellation": "8B5CF6",
};

/** Near-black brand colours would vanish on the dark theme, so those follow the text colour instead. */
function isDarkHex(hex: string) {
  const n = parseInt(hex, 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 60;
}

/** The bare brand mark, for inline use such as sign-in buttons. Renders nothing for unknown brands. */
export function BrandIcon({ id, className }: { id: string; className?: string }) {
  const drawn = DRAWN[id];
  if (drawn) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={cn("flex-none", className)}
        style={isDarkHex(drawn.hex) ? undefined : { color: `#${drawn.hex}` }}
      >
        {drawn.mark}
      </svg>
    );
  }

  const icon = ICONS[id];
  if (!icon) return null;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn("flex-none", className)}
      fill={isDarkHex(icon.hex) ? "currentColor" : `#${icon.hex}`}
    >
      <path d={icon.path} />
    </svg>
  );
}

/** The brand mark on a small tile, falling back to the first letter when there's no icon. */
export function ConnectorLogo({ id, name, className }: { id: string; name: string; className?: string }) {
  const hasMark = Boolean(DRAWN[id] ?? ICONS[id]);
  const tint = TINTS[id];

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 flex-none items-center justify-center rounded-lg border border-line-3 bg-surface text-xs font-bold text-fg",
        className,
      )}
      style={
        tint && !hasMark
          ? { background: `#${tint}`, borderColor: `#${tint}`, color: "#fff" }
          : undefined
      }
    >
      {hasMark ? <BrandIcon id={id} className="size-[58%]" /> : name[0]}
    </span>
  );
}
