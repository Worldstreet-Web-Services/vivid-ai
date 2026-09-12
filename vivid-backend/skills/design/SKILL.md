---
name: design
description: How to make a web app look designed rather than generated. Applies to every turn that creates or changes UI.
---

# Design method

You are designing for a real business and its customers, on phones first. A page is
finished when a stranger understands what it is and what to do within three seconds,
on a 390px screen, without zooming.

## Layout and rhythm
- One idea per section. Each section has one heading, one supporting line, one action.
- Spacing on a 4px grid, in steps of 4/8/12/16/24/32/48/64/96. Section padding: py-16 on
  phones, py-24 on desktop. Never two different gaps doing the same job.
- Content width: max-w-6xl for pages, max-w-prose for text. Center it. Side padding px-4
  on phones, px-6 from sm, px-8 from lg.
- Grid: 1 column on phones, 2 from sm or md, 3 or 4 from lg. Cards in a grid have equal
  height and the same internal padding.
- Align to the left edge inside sections; center only short heroes and empty states.

## Type
- Two sizes of heading per page, one body size, one small size. Nothing else.
- Pick the pairing from the fonts table by audience, load it, and use the display font
  on every heading. A shop for young buyers wants the grotesk pairing; a bakery the
  editorial one. Never leave the default system font on headings.
- Hero: text-4xl sm:text-5xl lg:text-6xl, font-semibold, tracking-tight, leading-[1.05].
- Section titles: text-2xl sm:text-3xl, font-semibold, tracking-tight.
- Body: text-base leading-relaxed; secondary text: text-sm text-muted-foreground.
- Line length under 65 characters: max-w-prose or max-w-xl on paragraphs.
- Load the chosen font pairing in index.html (Google Fonts) and set it in index.css.

## Colour and contrast
- Use the theme tokens (background, foreground, primary, muted, accent, border). Add at
  most one accent colour for the whole app; use it for the primary action and links.
- Premium reads as restraint: never a pure saturated primary (#ff0000, #0000ff). Soften
  the accent (a coral instead of red, a cobalt instead of blue: chroma about 0.15 to
  0.19 in oklch) and use it on the primary button, eyebrow labels and one highlight per
  screen, nothing else. On dark themes: background near-black (oklch 0.13 to 0.16),
  cards one step lighter, borders at white/10, text at 0.92 not pure white.
- An eyebrow label above the hero headline (small caps, tracking-wider, accent colour,
  a place or a promise: "SURULERE · LAGOS") is worth more than a badge.
- Body text is foreground on background, never grey on grey. Muted text only for labels,
  captions and metadata, and never below 14px.
- Dark mode works because you used tokens, not literal colours. Never hardcode #fff.

## Imagery
- Every image has a fixed aspect ratio (aspect-[4/3], aspect-square, aspect-video), fills
  it with object-cover, and has a rounded-lg or rounded-xl corner matching the cards.
- Uploaded files are the product; show them large.
- No upload for a product, a hero or a section that needs a picture? Make one with
  generate_image: describe the exact item ("a red and white running sneaker, side view,
  on a light grey surface"), one image per product, and one kind=lifestyle image for the
  hero (a group of the products in dramatic light). Never ship a grey box, a broken image
  or an empty aspect-ratio block. If image generation is unavailable, use a gradient
  block with the item's initial as the last resort.
- Consistency is what makes generated photos look like a real catalogue: use the same
  phrase for the setting in every product prompt ("on a light grey studio surface, side
  view, soft light") so the set matches; vary only the item.
- Logo: if the user uploaded one, use it in the header at h-8 (phones) to h-10, never
  stretched. If not, make a mark with generate_image kind=logo (a single simple symbol
  tied to the business, in the accent colour on the background colour, no text), show it
  at h-8 to h-9 with rounded-lg, and set the brand name next to it in the heading font
  (font-semibold tracking-tight). The mark gives the name a face; the type keeps it sharp.

## Components and states
- Use the shadcn components in src/components/ui. One primary button per view; the rest
  are outline or ghost. Buttons have a clear verb ("Book a slot", not "Submit").
- Every list has an empty state with one line and one action. Every async action has a
  loading state and a toast on success or failure.
- Inputs have labels above, help text below, and a visible focus ring. Touch targets are
  at least h-11 on phones.
- Hover states are subtle (a border or background shift), never a jump in size.

## Navigation
- Header: logo left, up to five links, one primary action right. On phones the links
  collapse into a menu button (use the dropdown-menu component); the primary action stays.
- Footer: business name, contact, hours or address, and the same links. Real details from
  the spec, no lorem ipsum, no "Copyright 2024".

## Copy
- Headlines say what the business does for the customer, in plain words. No "Welcome to".
- Prices show the currency the spec uses, formatted (₦12,000, not 12000).
- Nigerian context when the spec is Nigerian: naira, WhatsApp as a contact channel, local
  place names, phone formats like 0803 123 4567.

## Before you finish a page
Check, in this order: phone width first (does anything overflow or wrap badly?), then
desktop; heading hierarchy; consistent spacing; every image has an aspect ratio and its
file exists in public/uploads (a card showing alt text is a bug); primary action visible
without scrolling on the home page; nothing says placeholder or TODO.
