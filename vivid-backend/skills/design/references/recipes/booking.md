# Recipe: booking (salon, clinic, barber, classes)

Pages: Home, Services, Book, My bookings (lookup by phone or account), Admin (owner list).

Home: hero with the place's photo or a warm gradient, name, one line, "Book now"; services
grid with duration and price; hours and location; testimonials (only if the spec gives
them); footer with phone and WhatsApp.

Book flow, one step per screen on phones, one card on desktop: 1 pick a service (cards),
2 pick a date (next 14 days as pills) and a time slot (grid of available times),
3 name and phone, 4 confirmation with a summary and "Add to calendar" and WhatsApp link.
Show the running summary on desktop in a sticky right column.

My bookings: a phone number input, then a list with status badges and a cancel button
with a confirm dialog.

Admin (at /admin, behind the owner's sign-in, not in the customer nav): today's and upcoming
bookings as a table on desktop and cards on phones; filter by
day; mark done or no-show. Keep it behind a simple gate if there is no auth.

Data: services (id, name, minutes, price), bookings (id, serviceId, date, time, name, phone,
status). Slot generation from opening hours in the spec.

Minimums for a first build: 6 to 8 services with real prices and durations, opening hours
from the spec driving the slots, the full four-step booking flow, My bookings in the nav, Admin at /admin behind a
gate and out of the customer nav, and eight seeded sample bookings so the admin view is not empty.
