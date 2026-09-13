# Recipe: inventory (stock, products, suppliers, purchases and a simple point of sale)

An app behind sign-in with roles (owner, cashier). Pages: Dashboard, Products, Stock
(levels and movements), Purchases (from suppliers), Sales or POS, Suppliers, Reports,
Settings. Owner area is the app itself; cashiers see POS and their sales only.

Dashboard: stock value, low-stock count, today's sales, top products, a sales chart, low
stock list with Reorder.

Products: table with SKU, name, category, cost, price, quantity, reorder level, barcode;
edit in a sheet; import CSV; Stock: movements log (in, out, adjust) with reasons.

POS: a fast grid of products with search and barcode input, a cart, discounts, payment
(cash, transfer, card via Paystack terminal note), a receipt to print or WhatsApp; each
sale decrements stock.

Purchases: purchase orders to suppliers, receiving stock, costs updated. Reports: sales by
day and product, margins, stock valuation, export CSV.

Data: products, categories, suppliers, stock movements, purchase orders and items, sales
and sale items, users with roles.

Minimums for a first build: 40 products across 8 categories with stock levels, the POS
selling to a receipt with stock decrementing, purchases receiving stock, reports with
real numbers, roles enforced.
