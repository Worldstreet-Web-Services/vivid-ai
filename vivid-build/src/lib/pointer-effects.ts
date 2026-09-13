/**
 * Imperative pointer effects. They write styles straight to the node so the
 * pointer can move without re-rendering React. Each returns a cleanup, which
 * makes them usable as React 19 ref callbacks.
 */

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Tilt and magnet are mouse affordances; on touch screens they fight with scrolling. */
const hasFinePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const skipMotionEffects = () => prefersReducedMotion() || !hasFinePointer();

function onPointer(
  node: HTMLElement,
  move: (event: PointerEvent, rect: DOMRect) => void,
  leave: () => void,
) {
  const handleMove = (event: PointerEvent) => move(event, node.getBoundingClientRect());
  node.addEventListener("pointermove", handleMove);
  node.addEventListener("pointerleave", leave);
  return () => {
    node.removeEventListener("pointermove", handleMove);
    node.removeEventListener("pointerleave", leave);
  };
}

/** Tilts a card towards the pointer. */
export function bindTilt(node: HTMLElement) {
  if (skipMotionEffects()) return undefined;
  return onPointer(
    node,
    (event, rect) => {
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      node.style.transform = `perspective(1100px) rotateY(${px * 7}deg) rotateX(${-py * 6}deg) translateZ(6px)`;
    },
    () => {
      node.style.transform = "perspective(1100px) rotateY(0deg) rotateX(0deg)";
    },
  );
}

/** Pulls a button slightly towards the pointer. */
export function bindMagnet(node: HTMLElement) {
  if (skipMotionEffects()) return undefined;
  return onPointer(
    node,
    (event, rect) => {
      const x = (event.clientX - rect.left - rect.width / 2) * 0.22;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.3;
      node.style.transform = `translate(${x}px, ${y}px)`;
    },
    () => {
      node.style.transform = "translate(0, 0)";
    },
  );
}

/** Tracks the pointer in --glow-x / --glow-y for a radial highlight layer. */
export function bindGlow(node: HTMLElement) {
  return onPointer(
    node,
    (event, rect) => {
      node.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
      node.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
    },
    () => {},
  );
}
