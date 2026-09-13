"use client";

import { ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PlanBadge } from "@/components/ui/plan-badge";
import { cn } from "@/lib/cn";
import { filterGroups, SETTINGS_GROUPS } from "./nav-links";
import { useSettingsProject } from "./settings-project";

export function SettingsNav() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const navId = useId();
  const { projectId } = useSettingsProject();

  const groups = useMemo(() => filterGroups(SETTINGS_GROUPS, query), [query]);

  // The nav is taller than the viewport on short screens, so landing deep in
  // the list would otherwise show a nav with the current page scrolled out of
  // sight. `nearest` leaves it alone when it is already visible.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Deferred a frame: on first paint the container has not overflowed yet,
    // so scrolling it immediately is a no-op. Scrolling the container directly
    // rather than scrollIntoView also avoids moving the page behind it.
    const id = requestAnimationFrame(() => {
      const container = containerRef.current;
      const active = container?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!container || !active) return;
      if (container.scrollHeight <= container.clientHeight) return;

      // Measured from rects rather than offsetTop, which is relative to
      // whichever ancestor happens to be positioned.
      const box = container.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      const below = item.bottom - box.bottom;
      const above = box.top - item.top;
      if (below > 0) container.scrollTop += below + 8;
      else if (above > 0) container.scrollTop -= above + 8;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  const currentLabel =
    SETTINGS_GROUPS.flatMap((group) => group.links).find((link) => link.href === pathname)?.label ?? "Settings";

  return (
    // A plain button rather than <details>: a closed <details> hides every
    // non-summary child regardless of CSS, so `md:flex` could never bring the
    // nav back on desktop.
    // Sticky from md up so the nav stays put while the page scrolls, and
    // scrolls on its own only when it outgrows the viewport. self-start stops
    // the grid stretching it, which would defeat position: sticky.
    <div
      ref={containerRef}
      className="no-scrollbar md:sticky md:top-6 md:max-h-[calc(100dvh-5rem)] md:self-start md:overflow-y-auto md:overscroll-contain"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={navId}
        onClick={() => setOpen((current) => !current)}
        className="mb-2 flex w-full cursor-pointer items-center justify-between rounded-xl border border-line-2 bg-surface px-3 py-2 text-[13px] font-semibold text-fg md:hidden"
      >
        {currentLabel}
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 text-muted-2 transition-transform", open && "rotate-180")}
        />
      </button>
      {/* Collapsed on mobile until opened; always visible from md up. */}
      <nav id={navId} aria-label="Settings" className={cn("flex-col gap-3 md:flex", open ? "flex" : "hidden")}>
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search settings
        </label>
        <input
          id={searchId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search settings"
          className="w-full rounded-xl border border-line-2 bg-surface px-3 py-2 text-[13px] text-fg outline-none transition-colors focus-visible:border-line-3"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer items-center px-1 text-muted-3 hover:text-fg"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        )}
      </div>

      {groups.length === 0 && <p className="px-3 py-4 text-[13px] text-muted-3">No settings match.</p>}

      {groups.map((group) => (
        <div key={group.heading ?? "account"}>
          {group.heading && (
            <h2 className="mb-1 px-3 text-[11px] font-bold tracking-[0.1em] text-muted-3 uppercase">
              {group.heading}
            </h2>
          )}
          <div className="flex flex-col gap-px">
            {group.links.map((link) => {
              const active = pathname === link.href;
              const href = link.projectScoped && projectId ? `${link.href}?project=${projectId}` : link.href;
              return (
                <Link
                  key={link.href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors",
                    active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <span className="truncate">{link.label}</span>
                  {link.tier && <PlanBadge tier={link.tier} />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      </nav>
    </div>
  );
}
