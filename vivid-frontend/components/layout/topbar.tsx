"use client";

import Link from "next/link";

import { BellIcon } from "@/components/ui/icons";
import { topicNav } from "@/components/layout/nav-items";

export function Topbar() {
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-5">
      <nav aria-label="Topics" className="hidden items-center gap-5 md:flex">
        {topicNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-[13px] font-medium text-white/55 transition-colors hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Notifications"
          className="hover:vd-glass-control grid size-9 cursor-pointer place-items-center rounded-lg text-white/55 transition-colors hover:text-white"
        >
          <BellIcon size={18} />
        </button>
      </div>
    </header>
  );
}
