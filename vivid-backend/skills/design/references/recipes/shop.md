# Recipe: shop (ecommerce)

Pages: Home, Shop (grid with filters), Product, Cart, Checkout (or an order form), About/Contact.

Home: header with logo and cart count; hero with the strongest product photo, a one-line
promise and "Shop now"; a 2-then-4 column grid of featured products (photo, name, price,
add button); a trust strip (delivery, returns, payment on delivery, WhatsApp support); a
short brand story; footer with contact and hours.

Product card, exactly this: aspect-square image on a light neutral surface; over the image
a status badge ("New", "4 left", "Sold out") top-left; below: the brand as a small-caps
eyebrow (text-xs tracking-wider text-muted-foreground), the model name (font-medium), the
colourway line ("Grey / Neon Orange", text-sm muted), the price (font-semibold, ₦),
a row of size pills (h-9, selected one in the accent), and a full-width "Add to cart ·
UK 7" button that reflects the selected size. Sold-out pairs keep the card, grey the
button and say "Sold out".

Hero: an eyebrow with the place ("SURULERE · LAGOS"), a two-line outcome headline, one
line of specifics (brands, sizes, payment on delivery), two buttons, and a proof line
under them ("12 pairs in stock · from ₦138,000") computed from the data. The image is a
kind=lifestyle shot of several products in dramatic light, bleeding to the right edge.

Product page: gallery left (aspect-square, thumbnails below on desktop), details right:
name, price, size selector as pill buttons, add to cart primary, delivery note, description.

Cart: a drawer (dialog on phones) with line items, quantity steppers, subtotal, "Checkout".
Checkout: name, phone, address, delivery area select, payment method (pay on delivery or
transfer), order summary; confirmation screen with an order number and a WhatsApp link.

Data: products (id, name, price, images, sizes, category, stock), cart in localStorage or
the store; orders when a backend exists. Prices in the spec's currency, formatted.

Minimums for a first build: 8 to 12 products across at least three categories, each with a
name, brand, colourway, price, two-line description, sizes or variants, stock, and an image
(uploaded or generated); a brands strip that lists only brands present in the data; every
page above exists and is in the nav (including About and Admin when the spec has them);
the cart works end to end to the order screen.
