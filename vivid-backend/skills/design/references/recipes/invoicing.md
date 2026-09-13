# Recipe: invoicing (invoices, quotes, expenses, clients: a small-business finance tool)

An app behind sign-in (the dashboard recipe's density rules), with a public invoice page
for clients.

Pages: Dashboard, Invoices, New invoice, Invoice (public link for the client with Pay),
Quotes, Clients, Expenses, Reports, Settings (business details, logo, bank, tax). Owner is
the user; multi-user only if the spec says.

Dashboard: 4 stat cards (outstanding, overdue, paid this month, expenses this month), a
cash chart, overdue invoices list with Send reminder, recent activity.

Invoices: table with status badges (draft, sent, viewed, paid, overdue), filters, bulk
actions; New invoice: client picker, line items with quantity and unit price, tax and
discount, due date, notes, a live preview, Save draft and Send (email or a copy link);
the client page: the invoice laid out as a document, Download PDF (print styles), Pay
with Paystack when enabled, marked paid on success.

Data: business, clients, invoices and items, quotes, payments, expenses (category,
receipt), settings, numbering sequences.

Minimums for a first build: sign in, 12 seeded invoices across statuses for 6 clients,
the invoice builder with a preview, the public invoice page printing cleanly, expenses
and a working reports page.
