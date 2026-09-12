# Recipe: shop (ecommerce)

Pages: Home, Shop (grid with filters), Product, Cart, Checkout (or an order form), About/Contact.

Home: header with logo and cart count; hero with the strongest product photo, a one-line
promise and "Shop now"; a 2-then-4 column grid of featured products (photo, name, price,
add button); a trust strip (delivery, returns, payment on delivery, WhatsApp support); a
short brand story; footer with contact and hours.

Product card: aspect-square image, name (font-medium), price (font-semibold), an outline
"Add to cart" that turns into a quantity stepper once added. Badge for "New" or "Sold out".

Product page: gallery left (aspect-square, thumbnails below on desktop), details right:
name, price, size selector as pill buttons, add to cart primary, delivery note, description.

Cart: a drawer (dialog on phones) with line items, quantity steppers, subtotal, "Checkout".
Checkout: name, phone, address, delivery area select, payment method (pay on delivery or
transfer), order summary; confirmation screen with an order number and a WhatsApp link.

Data: products (id, name, price, images, sizes, category, stock), cart in localStorage or
the store; orders when a backend exists. Prices in the spec's currency, formatted.

Minimums for a first build: 8 to 12 products across at least three categories, each with a
name, price, two-line description, sizes or variants, and an image (uploaded or generated);
every page above exists and is in the nav; the cart works end to end to the order screen.
