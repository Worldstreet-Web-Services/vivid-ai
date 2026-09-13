"use client";

import { useId, useState } from "react";

export type Faq = { q: string; a: string };

/** Single-open accordion. The first item starts expanded, as in the design. */
export function FaqList({ items }: { items: readonly Faq[] }) {
  const [openIndex, setOpenIndex] = useState(0);
  const baseId = useId();

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const open = i === openIndex;
        const panelId = `${baseId}-panel-${i}`;
        return (
          <div key={item.q} className="overflow-hidden rounded-[14px] border border-line-2 bg-surface">
            <h3>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? -1 : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-[18px] text-left text-base font-semibold text-fg"
              >
                {item.q}
                <span aria-hidden className="flex-none text-xl leading-none text-accent">
                  {open ? "−" : "+"}
                </span>
              </button>
            </h3>
            <p
              id={panelId}
              hidden={!open}
              className="max-w-[640px] px-5 pb-5 text-[15px] leading-[1.62] text-pretty text-muted"
            >
              {item.a}
            </p>
          </div>
        );
      })}
    </div>
  );
}
