---
name: motion
description: Motion and polish for marketing pages and product sites: GSAP scroll animation, Framer Motion micro-interactions, parallax, grain and animated shader backgrounds, and the fonts that carry them. Applies to landing, platform, portfolio and shop home pages, and to any request that mentions animation.
---

# Motion and polish

Motion is the difference between a page that looks designed and one that feels designed.
It is also the fastest way to make a page feel cheap, so the rule is: few, slow, purposeful.
One entrance system for the whole page, one hover language, one hero effect. Nothing that
moves without a reason, nothing that repeats forever except an ambient background.

## Libraries (install only what the page uses)
- `npm install gsap` for scroll-driven animation (ScrollTrigger is in the gsap package:
  `import { ScrollTrigger } from "gsap/ScrollTrigger"; gsap.registerPlugin(ScrollTrigger)`).
- `npm install motion` for React micro-interactions (`import { motion, useInView, useReducedMotion } from "motion/react"`).
- No Three.js for a background; a 60-line WebGL fragment shader on a `<canvas>` is enough
  and loads instantly.
- Respect `prefers-reduced-motion`: `useReducedMotion()` from motion, or
  `window.matchMedia("(prefers-reduced-motion: reduce)")`; when set, render the final state
  with no animation.

## Entrances (Framer Motion)
One `Reveal` component in `src/components/motion/Reveal.tsx`: wraps children in
`motion.div` with `initial={{ opacity: 0, y: 24 }}`, `whileInView={{ opacity: 1, y: 0 }}`,
`viewport={{ once: true, margin: "-80px" }}`, `transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}`
and a `delay` prop. Use it on every section heading and card grid; stagger card grids with
`delay={i * 0.06}`. The hero reveals on load, staggered: eyebrow, headline lines, paragraph,
buttons, then the mockup slides up with a slight scale from 0.96.

## Hover and press
- Buttons: `whileHover={{ y: -1 }}` `whileTap={{ scale: 0.98 }}` plus a colour shift; never a
  size jump above 1.02.
- Cards: lift 2 to 4px with a shadow step, image inside scales to 1.04 over 600 ms.
- Links: an underline that grows from the left (`after:` pseudo with `scale-x`), 200 ms.
- Nav: the active item has a sliding pill (`layoutId="nav-pill"`) so it glides between items.

## Scroll (GSAP + ScrollTrigger)
- Numbers count up when they enter (`gsap.from(el, { textContent: 0, snap: { textContent: 1 }, duration: 1.4 })`).
- Feature rows: the mockup pins for one screen while three captions swap (`scrub: true`).
- Progress bar or step line that draws as you scroll (`scaleX` scrubbed to the section).
- Horizontal card rail on desktop: `x` scrubbed against the section height; plain vertical
  list on phones.
- Always `ScrollTrigger.refresh()` after images load and kill triggers in the effect cleanup.

## Parallax
Two or three layers in the hero moving at different rates: the background wash at 0.2,
the mockup at 0.5 and a floating badge or product at 0.8 (`gsap.to(layer, { yPercent: -20,
scrollTrigger: { scrub: true } })`). Subtle: 20 to 40px of travel over the hero height. Never
parallax body text. Off on phones and under reduced motion.

## Backgrounds: grain, glow, shaders
- Grain: a fixed full-screen `<div>` with an SVG `feTurbulence` noise as `background-image`,
  `opacity-[0.06]`, `mix-blend-multiply` (light) or `mix-blend-soft-light` (dark),
  `pointer-events-none`. This alone makes flat colour look printed.
- Glow: one or two `blur-3xl` radial gradients in the primary and partner colours behind
  the hero, `opacity-30`, animated 10 to 14 s drift with `motion.div` `animate={{ x, y }}` and
  `repeat: Infinity, repeatType: "mirror"`.
- Animated shader: `src/components/motion/ShaderBackdrop.tsx`, a `<canvas>` sized to its
  parent with a WebGL fragment shader (uniforms: `u_time`, `u_resolution`, `u_color1`,
  `u_color2`) drawing slow domain-warped noise or flowing gradient bands in the palette; 30
  fps cap, paused when off-screen (`IntersectionObserver`), hidden under reduced motion,
  and a static gradient fallback if WebGL is unavailable. Use it for a hero or a CTA band,
  never behind body text; keep text on a solid or tinted layer above it.
- Glitter or sparkle (a premium touch for beauty, events, luxury): a few small
  `motion.span` stars fading in and out at random positions in the hero over 2 to 4 s each,
  in the partner colour, at most eight at a time, off on phones.

## Fonts (load them like they matter)
- Pairing from the fonts table; load via Google Fonts with `display=swap` and preconnect
  links in index.html; set `font-feature-settings: "ss01", "cv11"` where the face supports
  it (Inter, Geist, Manrope) for the refined alternates; headline `text-wrap: balance`.
- Variable fonts (Inter, Manrope, DM Sans, Fraunces, Instrument Sans) let a headline animate
  weight on hover (`font-variation-settings`), a small premium detail.

## Performance and rules
- `will-change: transform` only on elements that animate; transforms and opacity only,
  never animate width, height, top or left.
- Lazy-load anything below the fold; images have width and height set so nothing jumps.
- Total added JS under 120 KB gzipped; skip GSAP if Framer Motion alone covers the page.
- Test on a phone width: no horizontal overflow from parallax layers (`overflow-hidden`
  on the hero) and no animation that blocks tapping.
