"use client";

import { cn } from "@/lib/cn";
import { hash32 } from "@/lib/seed";

type Props = {
  /** Used for the seeded tint, so each project keeps its own colour. */
  name: string;
  /**
   * A rendered screenshot when one exists. The API has none today — the build
   * agent's critique screenshots live inside the last assistant message, which
   * would cost one request per card — so this is the slot for a future
   * `Project.thumbnail_url` rather than something to fetch per card.
   */
  screenshotUrl?: string | null;
  /** "Planning" / "Building", shown as a small badge. */
  badge?: string;
  className?: string;
};

/**
 * The image on a project card.
 *
 * Until the backend exposes a screenshot this is a seeded gradient. It used to
 * be a live scaled iframe of locally generated HTML; with a real backend the
 * equivalent would boot one cloud sandbox per card, which costs money and takes
 * 5-60 seconds each, so it is deliberately not attempted.
 */
export function ProjectThumbnail({ name, screenshotUrl, badge, className }: Props) {
  const hue = hash32(name.toLowerCase()) % 360;

  return (
    <div
      // No width here on purpose: `cn` is a plain join, not tailwind-merge, so a
      // `w-full` baked in would fight any width the caller passes.
      className={cn(
        "relative isolate aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2",
        className,
      )}
    >
      {screenshotUrl ? (
        // Signed, time-limited URLs on a host that is not known at build time,
        // so next/image's remotePatterns cannot cover them.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={screenshotUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover object-top" />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, hsl(${hue} 38% 24%), var(--bg))` }}
        />
      )}

      {badge && (
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-chip px-2.5 py-1 text-[11px] font-semibold text-fg-2 backdrop-blur-sm">
          {badge}
        </span>
      )}
    </div>
  );
}
