# Recipe: restaurant (menu, ordering, reservations for one restaurant, cafe or bar)

Pages: Home, Menu, Order (pickup or delivery cart), Reserve a table, About, Contact. Owner
area at /admin: orders, reservations, menu editor, opening hours.

Home: hero with one signature dish photo (kind=photo, close and warm), the promise ("Smoky
jollof, Sunday to Sunday"), Order and Reserve buttons, opening status ("Open now · closes
10pm") computed from hours; a "what we are known for" row of three dishes with prices; a
strip for delivery zones and fee; a reservation teaser; the story; Instagram-style photo
grid; footer with address, phone, WhatsApp, hours.

Menu: sections (Starters, Mains, Grills, Drinks, Desserts) as a sticky pill nav; each item:
name, one-line description, price, tags (spicy, vegetarian), photo where one exists, Add
button with a modifiers sheet (size, extras, notes) when the item has options.

Order: cart drawer, pickup or delivery toggle, time slot picker within opening hours,
address with zone fee, phone, payment (Paystack or pay at counter as the spec says),
confirmation with an order number and estimated time.

Reserve: date, time slots from hours, party size, name and phone, notes; confirmation and
a "we will confirm on WhatsApp" line; owner sees reservations by day.

Data: menu sections and items (name, description, price, tags, options, photo, available),
orders (items, type, slot, address, status), reservations (date, time, size, name, phone,
status), hours, zones.

Minimums for a first build: 5 sections with 20 to 30 items total, prices in the spec's
currency, at least 8 item photos, a working cart to the confirmation screen, reservations
saved, admin gated at /admin with orders, reservations and the menu editor.
