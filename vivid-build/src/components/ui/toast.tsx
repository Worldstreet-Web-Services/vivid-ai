"use client";

import { TriangleAlert } from "lucide-react";
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { randomId } from "@/lib/id";

type Toast = { id: string; message: string; tone: "info" | "warn" };

const DURATION_MS = 3500;
const MAX_VISIBLE = 3;

const ToastContext = createContext<{ toast: (message: string, tone?: Toast["tone"]) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: Toast["tone"] = "info") => {
      const id = randomId();
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, message, tone }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), DURATION_MS));
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-300 flex flex-col gap-2"
      >
        {toasts.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => dismiss(item.id)}
            className="pointer-events-auto max-w-[320px] cursor-pointer rounded-xl border border-line-2 bg-surface px-4 py-3 text-left text-[13px] font-semibold text-fg shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
          >
            {item.tone === "warn" && <TriangleAlert aria-hidden className="mr-1.5 inline size-3.5 align-[-2px] text-warn" />}
            {item.message}
          </button>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const context = use(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
