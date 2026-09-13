"use client";

import { CalendarCheck, ShoppingBag, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { createProject } from "@/lib/api/endpoints";
import { setFirstMessage } from "@/lib/api/first-message";
import { takePendingPrompt } from "@/lib/pending-prompt";
import { DASHBOARD_CHIPS, PROJECT_TEMPLATES, type ProjectTemplate } from "./data";

/**
 * The panel above each starter used to be a gradient from --surface2 to --bg:
 * on the dark theme that is two near-blacks, so all three read as empty boxes.
 * An icon says what the starter is before the label does.
 */
const TEMPLATE_ICONS: Record<ProjectTemplate["icon"], typeof ShoppingBag> = {
  store: ShoppingBag,
  portal: UserRoundCog,
  booking: CalendarCheck,
};

/** The name the backend gets. The prompt itself becomes the first chat turn. */
function nameFromPrompt(prompt: string): string {
  const short = prompt.trim().replace(/\s+/g, " ").split(" ").slice(0, 6).join(" ");
  if (!short) return "Untitled app";
  return short.length > 40 ? `${short.slice(0, 39).trimEnd()}…` : short;
}

export function DashboardComposer() {
  const router = useRouter();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isPending, setPending] = useState(false);
  /** §2: build mode straight away, for people who already know what they want. */
  const [skipPlan, setSkipPlan] = useState(false);
  const promptId = useId();

  // Picks up a prompt typed on the landing page before signing in. Deferred
  // rather than read during render: /dashboard is prerendered, so touching
  // sessionStorage that early would desync the hydrated markup.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const pending = takePendingPrompt();
      if (pending) setPrompt(pending);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  /**
   * Creating a project and describing it are two steps now: the API takes a
   * name, and the prompt is the first chat turn. The prompt is parked for the
   * workspace to send on arrival, so the one-box flow still feels like one step.
   */
  const build = async (text: string) => {
    const request = text.trim();
    if (!request || isPending) return;
    setPending(true);
    try {
      const project = await createProject(nameFromPrompt(request), skipPlan);
      setFirstMessage(project.id, request);
      router.push(`/projects/${project.id}`);
    } catch (error) {
      setPending(false);
      toast(error instanceof Error ? error.message : "Could not start that project", "warn");
    }
  };

  const skipId = `${promptId}-skip`;

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void build(prompt);
        }}
        className="mt-[26px] rounded-[20px] border border-line-2 bg-surface p-[18px] text-left transition-colors focus-within:border-line-3"
      >
        <label htmlFor={promptId} className="sr-only">
          Describe what to build
        </label>
        <textarea
          id={promptId}
          rows={3}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            // Enter builds, Shift+Enter adds a line.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask VividBuild to build a storefront for your shoe brand"
          className="w-full resize-none bg-transparent text-base leading-normal text-fg outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setPrompt(chip)}
                className="cursor-pointer rounded-full border border-line-2 bg-surface-2 px-3 py-[7px] text-[13px] font-medium text-fg-2 transition-colors hover:border-accent hover:text-fg"
              >
                {chip}
              </button>
            ))}
          </div>
          <label
            htmlFor={skipId}
            title="Create straight into build mode, with no planning questions"
            className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] font-medium text-muted-3 transition-colors hover:text-fg-2"
          >
            <input
              id={skipId}
              type="checkbox"
              checked={skipPlan}
              onChange={(event) => setSkipPlan(event.target.checked)}
              className="size-[15px] flex-none accent-accent"
            />
            Skip planning
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="cursor-pointer rounded-full bg-btn px-5 py-[11px] text-sm font-bold text-btn-fg shadow-sheen disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? "Starting…" : "Build"}
          </button>
        </div>
      </form>

      <ul className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-3 text-left">
        {PROJECT_TEMPLATES.map((template) => (
          <li key={template.name}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => void build(template.prompt)}
              className="block w-full cursor-pointer overflow-hidden rounded-2xl border border-line-2 bg-surface text-left transition-colors hover:border-line-3 disabled:cursor-wait disabled:opacity-70"
            >
              <span
                aria-hidden
                className="flex h-24 items-center justify-center border-b border-line bg-surface-2 text-muted-3"
              >
                {(() => {
                  const Icon = TEMPLATE_ICONS[template.icon];
                  return <Icon className="size-7" strokeWidth={1.5} />;
                })()}
              </span>
              <span className="block px-3.5 py-3">
                <span className="block text-sm font-bold text-fg">{template.name}</span>
                <span className="mt-[3px] block text-xs text-muted">{template.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
