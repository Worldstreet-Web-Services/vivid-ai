"use client";

import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { BUILD_RUN_STEPS } from "./data";

type BuildRunState = {
  /** Active stage in the “How it builds” loop (0 prompt, 1 spec, 2 ship). */
  stage: number;
  running: boolean;
  log: readonly string[];
  progress: number;
  /** Spec tasks ticked off by a run; null until the first run starts. */
  doneTasks: number | null;
};

type Action =
  | { type: "select"; stage: number }
  | { type: "start" }
  | { type: "advance"; index: number }
  | { type: "finish" };

const initialState: BuildRunState = { stage: 1, running: false, log: [], progress: 0, doneTasks: null };

function reducer(state: BuildRunState, action: Action): BuildRunState {
  switch (action.type) {
    case "select":
      return state.stage === action.stage ? state : { ...state, stage: action.stage };
    case "start":
      return { ...state, running: true, log: [], progress: 0, doneTasks: 0, stage: 0 };
    case "advance": {
      const step = BUILD_RUN_STEPS[action.index];
      return {
        ...state,
        log: [...state.log, step.log].slice(-4),
        doneTasks: step.tasks,
        stage: step.stage,
        progress: Math.round(((action.index + 1) / BUILD_RUN_STEPS.length) * 100),
      };
    }
    case "finish":
      return { ...state, running: false };
  }
}

type BuildRunContextValue = BuildRunState & {
  selectStage: (stage: number) => void;
  startRun: () => void;
};

const BuildRunContext = createContext<BuildRunContextValue | null>(null);

/** Shares the simulated build between the hero prompt, the build loop and the spec checklist. */
export function BuildRunProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timers = timerRef;
    return () => window.clearInterval(timers.current);
  }, []);

  const selectStage = useCallback((stage: number) => dispatch({ type: "select", stage }), []);

  const startRun = useCallback(() => {
    window.clearInterval(timerRef.current);
    dispatch({ type: "start" });

    let index = 0;
    timerRef.current = window.setInterval(() => {
      dispatch({ type: "advance", index });
      index += 1;
      if (index >= BUILD_RUN_STEPS.length) {
        window.clearInterval(timerRef.current);
        dispatch({ type: "finish" });
      }
    }, 700);

    const target = document.getElementById("build");
    if (target) {
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
    }
  }, []);

  const value = useMemo(() => ({ ...state, selectStage, startRun }), [state, selectStage, startRun]);

  return <BuildRunContext value={value}>{children}</BuildRunContext>;
}

export function useBuildRun() {
  const context = use(BuildRunContext);
  if (!context) throw new Error("useBuildRun must be used inside <BuildRunProvider>");
  return context;
}
