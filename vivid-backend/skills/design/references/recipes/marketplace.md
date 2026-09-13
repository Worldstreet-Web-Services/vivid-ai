# Recipe: marketplace (many sellers, one storefront: vendors, buyers, orders, payouts)

Pages: Home, Shop (all products), Product, Store (a vendor's page), Cart and Checkout,
Sell on (vendor sign-up), Vendor dashboard, Buyer account. Owner area at /admin: vendors
approval, orders, payouts, categories.

Home: hero with the platform promise and a search, categories as tiles, featured vendors,
trending products grid (product card as in the shop recipe plus the vendor name), a trust
strip (escrow or buyer protection, delivery, returns), a "sell with us" band, footer.

Product: as the shop recipe, plus the vendor card (name, rating, other products, Message).
Store: banner, logo, about, products grid, reviews. Checkout: one order split per vendor
in the data model, one payment.

Vendor dashboard: products editor, orders to fulfil with status moves, earnings and payout
requests, store settings. Buyer account: orders with per-vendor status, reviews.

Roles: buyer, vendor (pending until approved), admin. Payments through Paystack; payouts
recorded and marked paid by admin.

Data: vendors (name, slug, logo, banner, about, status, owner), products (vendor,
name, price, stock, images, category), orders and order items with vendor, payouts,
reviews, categories.

Minimums for a first build: 8 vendors with logos and 40 products with images across 6
categories, cart to a paid order split by vendor, the vendor dashboard with orders and
products, vendor sign-up to pending, admin at /admin with approvals, orders and payouts.
