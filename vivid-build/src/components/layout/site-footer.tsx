import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { NAV_LINKS } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-gutter py-10">
      <Wordmark size="sm" />
      <nav aria-label="Footer" className="flex flex-wrap gap-[22px] text-[13px]">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-muted-3 transition-colors hover:text-fg">
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="text-[11px] font-semibold text-muted-3">© 2026 VividBuild</p>
    </footer>
  );
}
