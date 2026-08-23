// Glass needs something behind it. Over a flat black page a blurred surface has
// nothing to refract and renders as a grey rectangle, so the whole material
// collapses. These are the light sources the glass picks up.
//
// The gradients are painted directly as stacked background layers rather than
// as blurred divs. A CSS blur on a soft gradient spreads its peak and dilutes
// it, so the earlier version needed implausible alpha values to show up at all
// and still read as nothing. Radial gradients are already soft, cost far less
// to composite, and land at the alpha you actually ask for.
//
// Everything here is greyscale on purpose: the brand is monochrome, so depth
// comes from luminance, not colour. The layer is fixed and inert, under every
// route.
const AMBIENT = [
  // Key light, high and centred, roughly where the composer sits.
  "radial-gradient(72% 58% at 50% 16%, rgba(255,255,255,0.24), rgba(255,255,255,0.07) 44%, transparent 74%)",
  // Cool fill from the left, so the sidebar edge has an edge to catch.
  "radial-gradient(44% 52% at 0% 36%, rgba(202,214,240,0.20), transparent 70%)",
  // Warm-neutral bounce lower right, to stop the fill reading as one flat wash.
  "radial-gradient(48% 50% at 100% 86%, rgba(242,235,224,0.16), transparent 72%)",
  // A faint floor glow, so the page does not die at the bottom edge.
  "radial-gradient(76% 30% at 50% 100%, rgba(255,255,255,0.08), transparent 76%)",
  // Vignette last, so it sits over the fill and keeps glass edges legible
  // against the brightest part of it.
  "radial-gradient(140% 105% at 50% 14%, transparent 60%, rgba(0,0,0,0.38) 100%)",
].join(", ");

export function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ backgroundImage: AMBIENT }}
    />
  );
}
