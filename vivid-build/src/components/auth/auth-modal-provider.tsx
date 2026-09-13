"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { AuthModal } from "./auth-modal";

export type AuthMode = "login" | "signup";

type AuthModalContextValue = { openAuth: (mode?: AuthMode) => void };

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signup");

  const openAuth = useCallback((nextMode: AuthMode = "signup") => {
    setMode(nextMode);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openAuth }), [openAuth]);

  return (
    <AuthModalContext value={value}>
      {children}
      {open && <AuthModal mode={mode} onModeChange={setMode} onClose={close} />}
    </AuthModalContext>
  );
}

export function useAuthModal() {
  const context = use(AuthModalContext);
  if (!context) throw new Error("useAuthModal must be used inside <AuthModalProvider>");
  return context;
}
