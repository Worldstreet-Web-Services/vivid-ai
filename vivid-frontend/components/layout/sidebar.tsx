"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { SidebarIcon } from "@/components/ui/icons";
import { sidebarNav } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "vd-glass relative z-10 flex shrink-0 flex-col border-y-0 border-l-0 border-r-white/10 transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[232px]"
      )}
    >
      <div className="flex h-14 items-center justify-between px-3">
        {!collapsed ? (
          <Link href="/" className="ws-display px-1 text-[17px] text-white">
            Vivid
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="hover:vd-glass-control grid size-9 cursor-pointer place-items-center rounded-lg text-white/55 transition-colors hover:text-white"
        >
          <SidebarIcon size={18} />
        </button>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-2 py-2">
        {sidebarNav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                "flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/6 hover:text-white"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/8 p-2">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <Avatar name="Guest" size="sm" />
          {!collapsed ? (
            <span className="truncate text-[13px] font-medium text-white/70">Guest</span>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
