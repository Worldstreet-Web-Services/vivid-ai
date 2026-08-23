"use client";

import { useEffect } from "react";

// Route-level error boundary. Anything that escapes a feature lands here.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No reporter is wired up yet. Logging with the digest is what makes a
    // production error traceable once one is.
    console.error("Unhandled error:", error.digest, error);
  }, [error]);

  return (
    <div className="grid min-h-full place-items-center px-5 py-24 text-center">
      <div className="ws-inset max-w-[46ch] px-6 py-10">
        <h1 className="text-[15px] font-semibold text-white/85">Something went wrong</h1>
        <p className="mt-1.5 text-[12.5px] font-normal text-white/50">
          {error.message || "We hit an unexpected problem. Try again."}
        </p>
        <button
          onClick={reset}
          className="mt-5 cursor-pointer rounded-full border border-white/15 px-4 py-2 font-sans text-[12.5px] font-semibold text-white transition-colors hover:border-white/35"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
