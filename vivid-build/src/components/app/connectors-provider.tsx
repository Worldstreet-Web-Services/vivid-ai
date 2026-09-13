"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { ConnectorsDialog } from "./connectors-dialog";

const ConnectorsContext = createContext<{ openConnectors: () => void } | null>(null);

/**
 * Holds the catalogue dialog once, so the sidebar (which renders twice — rail
 * and drawer) and the command palette all open the same instance.
 */
export function ConnectorsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openConnectors: () => setOpen(true) }), []);

  return (
    <ConnectorsContext value={value}>
      {children}
      {open && <ConnectorsDialog onClose={close} />}
    </ConnectorsContext>
  );
}

export function useConnectors() {
  const context = use(ConnectorsContext);
  if (!context) throw new Error("useConnectors must be used inside <ConnectorsProvider>");
  return context;
}
