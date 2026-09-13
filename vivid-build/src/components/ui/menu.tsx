"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export type MenuItem =
  | {
      type?: "item";
      label: string;
      onSelect: () => void;
      /** Second line, for when the label alone doesn't say what the item does. */
      description?: string;
      danger?: boolean;
      disabled?: boolean;
      /** Leading glyph, shown before the label. */
      icon?: ReactNode;
      /** Trailing glyph — a check or dot marking the selected item. */
      trailing?: ReactNode;
    }
  | { type: "divider" };

const isItem = (item: MenuItem): item is Extract<MenuItem, { type?: "item" }> => item.type !== "divider";

type MenuProps = {
  /** The trigger's contents. The button itself is rendered here. */
  label: ReactNode;
  items: MenuItem[];
  /** Accessible name when `label` is only an icon. */
  ariaLabel?: string;
  className?: string;
  align?: "start" | "end";
  /** Forces a direction. Left unset, the menu flips up when it would run off the bottom. */
  side?: "bottom" | "top";
};

/** Anchored dropdown with click-outside, Escape and roving arrow-key focus. */
export function Menu({ label, items, ariaLabel, className, align = "start", side }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Flipping is applied to the node rather than held in state: this runs before
  // paint, so the menu never appears in the wrong place first, and setting state
  // from an effect would only cascade a second render to reach the same result.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = rootRef.current;
    if (!open || !menu || !trigger || side) return;

    const rect = trigger.getBoundingClientRect();
    const height = menu.getBoundingClientRect().height;
    const fitsBelow = height + 12 <= window.innerHeight - rect.bottom;
    const fitsAbove = height + 12 <= rect.top;
    if (fitsBelow || !fitsAbove) return;

    menu.classList.remove("top-full", "mt-1");
    menu.classList.add("bottom-full", "mb-1");
  }, [open, side, items]);

  const selectable = items.map((item, i) => (isItem(item) && !item.disabled ? i : -1)).filter((i) => i >= 0);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) rootRef.current?.querySelector("button")?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  const move = (delta: number) => {
    const position = selectable.indexOf(active);
    const next = selectable[(position + delta + selectable.length) % selectable.length] ?? selectable[0];
    setActive(next);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(selectable[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(selectable[selectable.length - 1]);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setActive(selectable[0] ?? 0);
          setOpen((current) => !current);
        }}
        className="w-full cursor-pointer text-left"
      >
        {label}
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          className={cn(
            "absolute z-100 min-w-[190px] overflow-hidden rounded-xl border border-line-2 bg-surface p-1 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)]",
            align === "end" ? "right-0" : "left-0",
            side === "top" ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {items.map((item, i) =>
            isItem(item) ? (
              <button
                key={item.label}
                ref={(node) => {
                  itemRefs.current[i] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={i === active ? 0 : -1}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                onMouseEnter={() => !item.disabled && setActive(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors",
                  item.disabled
                    ? "cursor-not-allowed text-muted-3"
                    : item.danger
                      ? "text-warn hover:bg-surface-2"
                      : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                )}
              >
                {item.icon && <span className="flex-none text-muted-2">{item.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.description && (
                    <span className="mt-px block text-[11px] font-medium text-muted-3">{item.description}</span>
                  )}
                </span>
                {item.trailing && <span className="flex-none text-muted-2">{item.trailing}</span>}
              </button>
            ) : (
              <div key={`divider-${i}`} role="separator" className="my-1 h-px bg-line" />
            ),
          )}
        </div>
      )}
    </div>
  );
}
