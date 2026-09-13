"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { updateWorkspacePrefs, usePrefs } from "@/lib/store/prefs";
import { LogoMark } from "@/components/brand/logo";
import { AppSidebar } from "./app-sidebar";
import { CommandPaletteProvider, useCommandPalette } from "./command-palette";
import { ConnectorsProvider } from "./connectors-provider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ConnectorsProvider>
      <CommandPaletteProvider>
        <ShellLayout>{children}</ShellLayout>
      </CommandPaletteProvider>
    </ConnectorsProvider>
  );
}

function ShellLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const { openPalette } = useCommandPalette();
  const prefs = usePrefs();
  const collapsed = prefs.status === "ready" && prefs.data.workspace.sidebarCollapsed;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-fg">
      <aside
        aria-label="App navigation"
        className={cn(
          "hidden flex-none border-r border-line bg-bg-2 transition-[width] duration-200 ease-soft lg:block",
          collapsed ? "w-[68px]" : "w-[250px]",
        )}
      >
        {/* The sidebar reads ?filter= to highlight Starred / Owned by me. */}
        <Suspense fallback={null}>
          <AppSidebar
            collapsed={collapsed}
            onToggleCollapsed={() => updateWorkspacePrefs({ sidebarCollapsed: !collapsed })}
          />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-bg-2 px-4 py-3 lg:hidden">
          <Link href="/" className="flex items-center gap-2.5 text-fg">
            <LogoMark />
            <span className="text-base font-extrabold tracking-[-0.03em]">VividBuild</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openPalette}
              className="cursor-pointer rounded-full border border-line-2 bg-surface px-3.5 py-2 text-[13px] font-semibold text-fg-2"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="app-drawer"
              aria-label="Open navigation"
              className="flex size-9 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-full border border-line-2 bg-surface"
            >
              <span className="block h-[1.5px] w-4 bg-fg" />
              <span className="block h-[1.5px] w-4 bg-fg" />
            </button>
          </div>
        </header>

        <main id="main" className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-100 lg:hidden">
          <div aria-hidden className="absolute inset-0 bg-[rgba(6,7,9,0.62)] backdrop-blur-[6px]" onClick={closeDrawer} />
          <aside
            id="app-drawer"
            aria-label="App navigation"
            className="relative h-full w-[min(280px,85vw)] border-r border-line bg-bg-2"
          >
            <Suspense fallback={null}>
              <AppSidebar onNavigate={closeDrawer} />
            </Suspense>
          </aside>
        </div>
      )}
    </div>
  );
}
