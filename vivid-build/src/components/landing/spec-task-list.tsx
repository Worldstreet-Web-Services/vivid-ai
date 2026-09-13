"use client";

import { cn } from "@/lib/cn";
import { useBuildRun } from "./build-run-context";
import { SPEC_TASKS } from "./data";

/** Checklist that ticks off live while a simulated build runs. */
export function SpecTaskList() {
  const { doneTasks } = useBuildRun();

  return (
    <ul className="flex flex-col gap-2.5">
      {SPEC_TASKS.map((task, i) => {
        const done = doneTasks === null ? task.done : i < doneTasks;
        return (
          <li
            key={task.name}
            className="flex items-start gap-3 rounded-xl border border-line-2 bg-surface-2 px-3.5 py-[13px]"
          >
            <span
              aria-hidden
              className={cn(
                "mt-px block size-4 flex-none rounded-[5px] border transition-[background-color,border-color] duration-400",
                done ? "border-accent bg-accent" : "border-line-3 bg-transparent",
              )}
            />
            <div>
              <p className="text-sm leading-[1.4] font-medium text-fg">{task.name}</p>
              <p className="mt-[3px] text-[11px] font-semibold text-muted-2">{done ? task.meta : "queued"}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
