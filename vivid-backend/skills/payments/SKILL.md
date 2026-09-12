---
name: payments
description: How to take payments with Paystack in an app the builder makes. Applies when the project has payments enabled.
---

# Payments with Paystack

The owner's Paystack account is connected. The app pays into it; this app never holds
money. Amounts are in kobo (₦12,500 is 1250000). Currency NGN. Paystack accepts cards,
bank transfer, USSD and Opay; you do not build those, the checkout does.

## Which flow
- **With a Supabase backend (the project has one)**: the verified flow. Orders are rows;
  a payment is only "paid" when Paystack tells the server so.
- **Without a backend**: the inline flow. The browser opens Paystack's checkout with the
  public key; on the success callback the app marks the order paid locally and shows
  the reference. Tell the user in one line that a backend would make this verified.

## Inline checkout (both flows start here)
`VITE_PAYSTACK_PUBLIC_KEY` is set in .env. Use `@paystack/inline-js`, already installed:

```ts
import PaystackPop from "@paystack/inline-js";
const paystack = new PaystackPop();
paystack.newTransaction({
  key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
  email, amount: totalKobo, currency: "NGN",
  reference,                       // your order id, unique
  metadata: { orderId, items },
  onSuccess: (tx) => { /* inline flow: mark paid, show tx.reference */ },
  onCancel: () => toast("Payment cancelled"),
});
```
Collect the email and phone before opening checkout. Show the total in naira, then the
Paystack popup, then a confirmation page with the reference and what happens next.

## Verified flow (with Supabase)
1. `apply_migration`: `orders` table with id, items jsonb, amount_kobo, email, phone,
   status ('pending' | 'paid' | 'failed'), reference, paystack_id, created_at; RLS on;
   anon may insert a pending order and read its own by reference; only the service role
   updates status.
2. `deploy_edge_function("paystack-webhook", ...)`: POST handler, `verify_jwt` false.
   Read the raw body, compute HMAC SHA-512 of it with `Deno.env.get("PAYSTACK_SECRET_KEY")`,
   compare to the `x-paystack-signature` header; reject on mismatch. On
   `charge.success`, update the order whose `reference` matches to status 'paid' with
   the service role client. Answer 200 fast.
3. Optionally `deploy_edge_function("paystack-verify", ...)`: GET
   `https://api.paystack.co/transaction/verify/{reference}` with the secret key, for the
   confirmation page to poll when the webhook has not landed yet.
4. The app: create the pending order, open inline checkout with `reference = order.id`,
   then poll the order until 'paid' (or call paystack-verify), then confirm.
5. `PAYSTACK_SECRET_KEY` is already set as an edge-function secret. Never put it in the
   app, in .env, or in code.
6. Tell the user to add the webhook URL
   (`https://<ref>.supabase.co/functions/v1/paystack-webhook`) in Paystack's dashboard
   under Settings, API Keys & Webhooks. Say it in the final reply.

## Copy and UX
- Button: "Pay ₦12,500", not "Checkout". Show what is being paid for above it.
- Test mode: if the public key starts with pk_test_, show a small "Test mode" badge and
  mention test card 4084 0840 8408 4081 in the confirmation screen's help text.
- Failure and cancel states with a way to try again; never a blank screen.
