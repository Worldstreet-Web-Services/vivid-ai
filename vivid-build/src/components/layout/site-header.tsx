"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { Wordmark } from "@/components/brand/logo";
import { useScrolledPast } from "@/hooks/use-scrolled-past";
import { cn } from "@/lib/cn";
import { NAV_LINKS } from "@/lib/site";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  const scrolled = useScrolledPast(40);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-60 border-b border-line px-gutter backdrop-blur-[14px] transition-[padding,background-color] duration-300",
          scrolled ? "bg-(--header-bg-scrolled) py-2.5" : "bg-(--header-bg) py-4",
        )}
      >
        <div className="flex items-center justify-between gap-6">
          <Wordmark />

          <nav aria-label="Primary" className="hidden items-center gap-[22px] text-sm whitespace-nowrap lg:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("transition-colors hover:text-fg", active ? "text-fg" : "text-muted")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <AuthButton
              mode="login"
              className="hidden cursor-pointer px-3.5 py-[9px] text-sm font-medium whitespace-nowrap text-fg sm:block"
            >
              Log in
            </AuthButton>
            <AuthButton className="cursor-pointer rounded-full bg-btn px-[18px] py-2.5 text-sm font-semibold whitespace-nowrap text-btn-fg shadow-sheen">
              Start building
            </AuthButton>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex size-10 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-full border border-line-2 bg-surface lg:hidden"
            >
              <span
                className={cn(
                  "block h-[1.5px] w-4 bg-fg transition-transform duration-200",
                  menuOpen && "translate-y-[3.25px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-[1.5px] w-4 bg-fg transition-transform duration-200",
                  menuOpen && "-translate-y-[3.25px] -rotate-45",
                )}
              />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="mobile-nav" aria-label="Mobile" className="mt-3 flex flex-col border-t border-line pt-2 lg:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn("py-3 text-[15px]", pathname === link.href ? "text-fg" : "text-muted")}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center gap-2.5 py-3 sm:hidden">
              <ThemeToggle />
              <AuthButton mode="login" className="cursor-pointer px-3.5 py-[9px] text-sm font-medium text-fg">
                Log in
              </AuthButton>
            </div>
          </nav>
        )}
      </header>
      <div aria-hidden className="h-[69px]" />
    </>
  );
}
