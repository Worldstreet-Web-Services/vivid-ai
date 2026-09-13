/** The blinking block that marks text still arriving. Never shown on finished text. */
export function StreamingCaret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[1px] animate-caret bg-accent align-baseline"
    />
  );
}
