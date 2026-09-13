# Recipe: platform (delivery, logistics, fintech, marketplaces, SaaS with several roles)

The reference feel: a light, airy product site like a well-funded fintech. White or a
faint tinted wash, one deep primary (navy) for headings and dark bands, one bright partner
colour for every action, pill buttons, generous rounded corners (rounded-2xl on cards,
rounded-full on buttons and eyebrow pills), and the product itself shown on screen.

Pages (customer side): Home, How it works, Pricing or Zones, Track or Order, Sign in,
Sign up, the customer's account area (My orders), a public "Partner with us" page for the
other roles (riders, vendors) with their own sign-in. Owner side at /admin.

Home, in this order:
1. Header: logo mark + name left; centre nav (four links at most, one may be a segmented
   toggle between audiences like "Customers | Riders"); right: a ghost "Log in" and a
   solid pill "Create an account" in the primary. On phones: logo, menu button, and the
   primary pill stays.
2. Hero: eyebrow pill (rounded-full, tinted background, small icon, italic or medium text),
   a three-line outcome headline (text-5xl lg:text-6xl font-bold tracking-tight, primary
   colour, not pure black), one paragraph, two pill buttons (solid primary + bright partner
   or outline), then a trust row of partner or payment marks (small, muted). Right half: the
   ProductMockup, the app's real dashboard rendered with seeded data inside a laptop or
   phone frame, slightly overflowing the right edge on desktop, stacked below on phones.
3. "Why us" band: a centred eyebrow pill, one wide sentence in the primary at text-2xl,
   then a 3-column grid of benefit cards: each card has an illustration tile on top
   (aspect-[4/3] with a soft gradient background and either a kind=illustration image or a
   shape-and-icon composition), a bold title, two lines of copy. Six cards for a platform.
4. Feature rows: alternating two-column rows, each with an icon chip (h-14 w-14 rounded-2xl
   tinted), a title, one paragraph, a "Let's go" arrow link, and on the other side a second
   ProductMockup variant (the rider view, the order tracker, the admin table) or a screenshot
   card with shadow-xl and rounded-2xl.
5. Dark CTA band: a full-width rounded-3xl block in the primary with a centred icon,
   headline in white, one line, three pill buttons (outline in the partner colour, solid
   partner, outline).
6. A role section for the other audience: "Ride with us" or "List your restaurant", one
   card with a photo of a Black Nigerian in that role as a small rounded tile, a title,
   three bullet benefits, and a button to that role's sign-up.
7. Footer in the primary colour: big logo and tagline, three link columns (Company,
   Resources, Legal), social icon circles, a rule, copyright with the year from `new Date()`.

Section rhythm: py-20 lg:py-28; content max-w-7xl; everything centred that is a band,
left-aligned inside cards. Backgrounds alternate white / tinted wash / white / dark.

ProductMockup: a real component fed by the seed data (never a screenshot of nothing),
with the app's own sidebar, stat cards (formatted naira), a table or list with status
badges, and a small bar chart drawn with divs. It is the proof the product exists.

Admin (/admin): a sidebar layout (logo, six nav items with icons, sign out at the bottom),
top bar with the page title and the owner's name, stat cards in a 4-grid, a chart card, a
table with filters and status badges, row actions in a dropdown. Dense, tool-like, in the
same palette.

Minimums for a first build: every customer page above; the ProductMockup on the home page
with real seeded data; six benefit cards; at least two feature rows; the CTA band; the
role section; the footer; /admin with its dashboard, the main records table and the
people table (customers, riders or vendors) each with at least ten seeded rows.
