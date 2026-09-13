---
name: motion
description: Motion and polish for marketing pages and product sites: GSAP scroll animation, Framer Motion micro-interactions, parallax, grain and animated shader backgrounds, page transitions, and the fonts that carry them. Applies to landing, platform, portfolio and shop home pages, and to any request that mentions animation.
---

# Motion and polish

Motion is the difference between a page that looks designed and one that feels designed.
It is also the fastest way to make a page feel cheap. The rule: few, slow, purposeful. One
entrance system for the whole page, one hover language, one hero effect, one ambient
background at most. Nothing moves without a reason; nothing loops except ambience.

## The motion budget for a page
Pick from this list, in this order, and stop when the page has enough:
1. Entrances (always): sections and cards reveal once as they enter.
2. Hover and press language (always): buttons, cards, links, nav.
3. One hero effect: parallax layers, a shader backdrop, or a product mockup that tilts
   with the pointer. Never two.
4. One scroll story: a pinned feature section, a count-up stat row, or a horizontal rail.
5. Ambience: grain over everything; a slow glow drift in the hero or CTA band.
6. Page transitions between routes (shops and platforms with several pages).
A landing page uses 1 to 5. A shop uses 1, 2, 3 (mockup or product tilt), 6. A dashboard
uses 1 and 2 only, fast and small.

## Libraries and setup
- `motion` (Framer Motion) for React: entrances, hover, layout, page transitions.
  `import { motion, AnimatePresence, useInView, useReducedMotion, useScroll, useTransform } from "motion/react"`.
- `gsap` with ScrollTrigger for scroll-driven timelines and pinning:
  `import gsap from "gsap"; import { ScrollTrigger } from "gsap/ScrollTrigger"; gsap.registerPlugin(ScrollTrigger)`.
- Both are in the template; if an import fails, `npm install gsap motion`.
- Everything lives under `src/components/motion/` (patterns file has each file). Pages
  compose them; pages never call gsap directly.
- Reduced motion: every component checks `useReducedMotion()` (or the media query) and
  renders the final state with no animation. This is not optional.

## Timing and easing (use these numbers, do not invent)
- Entrance: 0.7 s, ease `[0.22, 1, 0.36, 1]` (a soft out-expo), travel 24 px up, from
  opacity 0. Stagger siblings by 0.06 s; a hero staggers by 0.1 s.
- Hover: 200 ms ease-out for colour and shadow; 600 ms for an image scale to 1.04.
- Press: `scale: 0.98`, 120 ms.
- Page transition: 0.35 s out, 0.45 s in; the new page fades and rises 12 px.
- Scroll scrub: `scrub: 0.6` (a little lag feels physical); never `scrub: true` on text.
- Ambient loops: 10 to 16 s, `repeatType: "mirror"`, `ease: "easeInOut"`.
- Count-up: 1.4 s, ease power2.out, integers snapped, run once.

## Entrances
`Reveal` wraps a block; `RevealGroup` staggers children; `SplitLines` reveals a headline
line by line with a clip mask (the premium one: each line rises out of an `overflow-hidden`
row). Hero order: eyebrow, headline lines, paragraph, buttons, proof row, then the mockup
rises with scale 0.96 to 1 over 0.9 s. Below the fold, `once: true` and `margin: "-80px"`
so nothing animates while still half off-screen.

## Hover and press language
- Primary button: `y: -1`, shadow one step up, background one shade darker; `whileTap`
  scale 0.98. Arrow icon inside translates 3 px on hover.
- Card: lift 4 px, `shadow-lg`, image inside scales 1.04; the whole card is the link.
- Nav: a sliding pill behind the active item (`layoutId="nav-pill"`), 300 ms; link
  underline grows from the left on hover.
- Magnetic buttons on the hero only: the button follows the pointer within 12 px and
  springs back (patterns file), desktop only.
- Icons in benefit tiles: rotate 6 degrees and scale 1.1 on card hover.

## Hero effects (choose one)
- Parallax: three layers at 0.2, 0.5 and 0.8 of scroll, 20 to 40 px of travel over the hero
  height, `overflow-hidden` on the hero, off on phones. Uses `useScroll` + `useTransform`.
- Shader backdrop: a WebGL canvas drawing slow domain-warped noise in the palette's two
  colours behind a solid text layer; 30 fps cap; paused off-screen; static gradient when
  WebGL is missing or reduced motion is on. Fintech, SaaS, events, luxury.
- Pointer tilt: the product mockup rotates up to 6 degrees toward the pointer with a
  spring (`useSpring`), and a soft highlight follows; desktop only.

## Scroll stories (choose one)
- Pinned features: the mockup pins for 300 vh while three captions and three mockup
  states swap (`ScrollTrigger` with `pin`, `snap` to thirds); on phones it is a plain
  stacked list.
- Count-up stats: numbers animate once when the row enters (GSAP textContent tween).
- Horizontal rail: a row of cards scrubbed sideways against a tall section; on phones a
  swipeable overflow-x row with `snap-x`.
- Progress line: a thin line that draws down a "how it works" list as you scroll.
- Marquee: a slow infinite strip of partner marks or dishes, paused on hover, duplicated
  content so the loop is seamless; CSS keyframes, no JS.

## Ambience
- Grain: SVG `feTurbulence` noise, fixed, `opacity-[0.06]`, `mix-blend-multiply` on light
  or `mix-blend-soft-light` on dark, `pointer-events-none`. Add it to every page with a
  hero. It makes flat colour look printed.
- Glow: two `blur-3xl` radial blobs in the primary and partner colours, `opacity-30`,
  drifting 60 px over 12 s, mirrored, behind the hero or the CTA band only.
- Glitter or sparkle (beauty, events, luxury): at most eight tiny stars fading in and
  out at random positions, 2 to 4 s each, partner colour, hero only, off on phones.
- Cursor glow (dark themes only): a 400 px radial highlight that follows the pointer at
  low opacity, desktop only.

## Page transitions
`AnimatePresence` around the routed outlet keyed by `location.pathname`; the page fades
and rises 12 px in, fades out. Scroll to top on route change. The header does not
re-mount. Use `mode="wait"`. Never on admin or dashboard routes.

## Fonts that carry motion
- Load the pairing from the fonts table with `display=swap` and preconnect links.
- Turn on the refined alternates where the face has them (`font-feature-settings: "ss01",
  "cv11"` for Inter and Geist; `"ss02"` for Manrope), `text-wrap: balance` on headlines.
- Variable fonts (Inter, Manrope, DM Sans, Fraunces, Instrument Sans, Bricolage Grotesque)
  can animate weight on hover with `font-variation-settings`; use it on one headline at most.
- Editorial pages: an italic serif for one word in the headline (`<em>`), the way fashion
  sites do; the eyebrow in small caps with `tracking-[0.2em]`.

## Performance rules
- Transforms and opacity only; never animate width, height, top, left, box-shadow on
  scroll (shadows on hover are fine).
- `will-change: transform` only on the elements that animate, removed after.
- Kill every ScrollTrigger and cancel every animation frame in the effect cleanup;
  `ScrollTrigger.refresh()` after images load.
- Images have width and height so nothing jumps; lazy-load below the fold.
- Added JS under 120 KB gzipped: skip GSAP when Framer Motion covers the page.
- Phones: no parallax, no shader, no magnetic buttons, no cursor glow; entrances and
  hover only. Test at 390 px for horizontal overflow (`overflow-x-clip` on the hero).

## Before you finish
Scroll the page once at desktop and once at phone width: nothing flickers on load (no
flash of the unanimated state: initial styles are set by motion, not by CSS after mount),
nothing animates twice, every animated element is reachable and readable while it moves,
and the page is still usable with animations off.
