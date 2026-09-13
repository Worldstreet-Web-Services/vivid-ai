"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/cn";
import { useProjects } from "@/lib/api/hooks";
import { useConnectors } from "./connectors-provider";

type Command = { id: string; label: string; hint?: string; run: () => void };

const CommandPaletteContext = createContext<{ openPalette: () => void } | null>(null);

/** ⌘K / Ctrl+K command bar for the signed-in app. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ openPalette: () => setOpen(true) }), []);

  return (
    <CommandPaletteContext value={value}>
      {children}
      {open && <CommandPalette onClose={close} />}
    </CommandPaletteContext>
  );
}

export function useCommandPalette() {
  const context = use(CommandPaletteContext);
  if (!context) throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>");
  return context;
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const { openConnectors } = useConnectors();
  const projectsSnapshot = useProjects();
  const projects = useMemo(
    () => (projectsSnapshot.status === "ready" ? projectsSnapshot.data : []),
    [projectsSnapshot],
  );
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const commands = useMemo<Command[]>(
    () => [
      { id: "new", label: "New project", hint: "Build", run: () => router.push("/dashboard") },
      { id: "dashboard", label: "Go to dashboard", run: () => router.push("/dashboard") },
      { id: "projects", label: "All projects", run: () => router.push("/projects") },
      ...projects.map((project) => ({
        id: `project-${project.id}`,
        label: `Open ${project.name}`,
        hint: "Recent",
        run: () => router.push(`/projects/${project.id}`),
      })),
      { id: "connectors", label: "Browse connectors", hint: "Catalogue", run: openConnectors },
      { id: "theme", label: "Switch light or dark style", hint: "Style", run: toggleTheme },
      { id: "pricing", label: "View plans and pricing", run: () => router.push("/pricing") },
      { id: "site", label: "Back to the website", run: () => router.push("/") },
    ],
    [router, projects, toggleTheme, openConnectors],
  );

  const needle = query.trim().toLowerCase();
  const results = commands.filter((command) => command.label.toLowerCase().includes(needle));
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  const run = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-start justify-center bg-[rgba(6,7,9,0.62)] px-4 pt-[15vh] backdrop-blur-[6px]">
      <div aria-hidden className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command bar"
        className="relative w-full max-w-[560px] overflow-hidden rounded-[18px] border border-line-2 bg-surface shadow-[0_50px_110px_-50px_rgba(0,0,0,0.85)]"
      >
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-${activeIndex}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search projects and commands…"
          className="w-full border-b border-line bg-transparent px-5 py-4 text-[15px] text-fg outline-none"
        />
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.map((command, i) => (
            <li
              key={command.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(command)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold",
                i === activeIndex ? "bg-surface-2 text-fg" : "text-muted",
              )}
            >
              {command.label}
              {command.hint && <span className="text-[11px] text-muted-3">{command.hint}</span>}
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-3">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
