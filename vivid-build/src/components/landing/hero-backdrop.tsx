"use client";

import dynamic from "next/dynamic";

// three.js is heavy and browser-only: load it after hydration, never on the server.
const HeroScene = dynamic(() => import("./hero-scene").then((mod) => mod.HeroScene), { ssr: false });

export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-[60px] z-0 h-[820px]">
      <HeroScene />
    </div>
  );
}
