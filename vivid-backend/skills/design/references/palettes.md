# Palettes

Pick one per project. Values are oklch, ready for index.css tokens. Each has a light and a
dark primary so the accent holds contrast in both modes.

| name | feel | light primary | dark primary | background hint |
|---|---|---|---|---|
| ink | serious, editorial | oklch(0.25 0.02 260) | oklch(0.85 0.02 260) | pure white, near-black text |
| forest | natural, grounded, food, wellness | oklch(0.42 0.12 150) | oklch(0.72 0.14 150) | warm off-white oklch(0.985 0.005 90) |
| cobalt | trust, tech, finance | oklch(0.5 0.2 258) | oklch(0.7 0.16 258) | cool white |
| terracotta | craft, bakery, hospitality | oklch(0.58 0.15 40) | oklch(0.75 0.13 40) | cream oklch(0.98 0.01 80) |
| plum | beauty, fashion, evening | oklch(0.45 0.16 330) | oklch(0.75 0.13 330) | soft blush oklch(0.985 0.008 340) |
| ember | sport, energy, sneakers | oklch(0.6 0.22 28) | oklch(0.72 0.19 28) | near-black background works: oklch(0.15 0 0) |
| sand | minimal, gallery, portfolio | oklch(0.35 0.03 70) | oklch(0.85 0.03 70) | sand oklch(0.97 0.01 80) |
| ocean | travel, clinics, calm | oklch(0.55 0.13 220) | oklch(0.75 0.11 220) | cool white |
| gold-on-black | luxury, salon, nightlife | oklch(0.78 0.14 85) | oklch(0.82 0.14 85) | black oklch(0.13 0 0), gold accent only |
| lime | youth, events, street | oklch(0.85 0.2 130) | oklch(0.85 0.2 130) | near-black, lime as the single accent |
| navy-lime | platforms, fintech, logistics, SaaS | primary navy oklch(0.28 0.06 265), bright partner lime oklch(0.9 0.19 125) | navy stays, lime as the action colour | white with a faint blue-tinted wash oklch(0.975 0.008 260) for section bands |
| navy-orange | delivery, food, marketplaces | primary navy oklch(0.28 0.06 265), bright partner orange oklch(0.72 0.19 45) | same | white, warm wash oklch(0.98 0.01 70) |
| green-cream | food delivery, groceries, fresh | primary green oklch(0.5 0.16 150), bright partner amber oklch(0.85 0.17 85) | green lighter | cream oklch(0.985 0.01 90) |

Apply: set --primary and --primary-foreground (and the dark block) in index.css. Keep
--muted, --border and --card as neutrals derived from the background. Never introduce a
second saturated colour; use tints of primary (bg-primary/10) for badges and highlights.
The two-tone rows (navy-lime, navy-orange, green-cream) are the exception for platforms:
the primary carries headings, dark bands and secondary buttons; the bright partner is the
one action colour (primary buttons, eyebrow pills, chart bars) and appears on every screen
exactly where the eye should go, nowhere else.
