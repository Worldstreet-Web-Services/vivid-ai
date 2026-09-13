---
name: fullstack
description: How to build a real app on Supabase (accounts, roles, data, orders, server-side work) so it works end to end for strangers, not only in a demo. Applies when the project has a Supabase backend linked.
---

# App logic on Supabase

The project has a real backend. That changes what "done" means: a stranger can sign up,
do the main thing the app is for, and the owner sees it in their area, with nobody
fixing anything by hand. Build the data and the rules first, then the screens on top.
Local state is for the UI only; nothing that matters lives in localStorage.

## Structure (keep every project the same)
- `src/lib/supabase.ts`: the client (exists). `src/lib/types.ts`: one row type per table,
  the status unions, and `Role`. `src/lib/db.ts`: typed query helpers, one function per
  read or write (`listProducts`, `createOrder`, `updateOrderStatus`); the screens call
  these and never `supabase.from(...)` directly. `src/lib/format.ts`: `naira()`,
  `phone()`, `dateLagos()`.
- `src/auth/`: `AuthProvider` (session + profile in context), `useAuth()`, `RequireAuth`
  and `RequireRole` route guards, and the pages sign-in, sign-up, forgot-password,
  reset-password. `src/pages/admin/`: the owner's screens. `src/pages/`: the customer's.
- Migrations through `apply_migration`, one per change, named for what they do
  (`create_profiles`, `create_orders`, `orders_policies`). Never one giant migration.
  When the tools are not available this turn, the same migrations are files under
  `supabase/migrations/` and functions under `supabase/functions/`, as the backend
  section says; the app is written the same either way.

## Accounts
- Supabase auth only: email and password by default; phone OTP (`signInWithOtp` with
  `phone`) when the spec says phone sign-in. Never a home-made users table.
- A `profiles` table keyed by `auth.users.id` with `full_name`, `phone`, `role`
  (`'customer' | 'staff' | 'admin'`, default `'customer'`), timestamps; filled by a
  database trigger on sign-up (patterns file). The app never inserts profiles itself.
- `AuthProvider` restores the session on reload (`getSession` then `onAuthStateChange`),
  loads the profile, and exposes `{ user, profile, loading, signIn, signUp, signOut }`.
  While `loading` is true show a centred spinner, never a flash of the sign-in page.
- Sign-up asks for name, email (or phone), password; it signs the user in and sends them
  to where they were going (`state.from`), else to the home page. Sign-in has a
  "Forgot password?" link; reset uses `resetPasswordForEmail` with
  `redirectTo: window.location.origin + "/reset-password"`.
- Other roles join by self sign-up with approval, never by hand in a dashboard: a
  "Ride with us" / "List your kitchen" / "Join as staff" form takes the role's details
  (name, phone, email, password, plus the role's fields: bike plate and areas, or the
  business name and address) and creates the account with that role and
  `status = 'pending'`. Pending accounts can sign in and see one screen: "Your application
  is being reviewed", with what happens next and a contact line. `/admin` lists pending
  applications first with Approve and Reject buttons; approval is an update the policies
  allow only for admin, so no server code is needed. Approved accounts land on their
  dashboard; rejected ones see why. The owner may also change status later (suspend).
- `AuthProvider.loading` must resolve: it is false as soon as `getSession` returns, and
  the profile loads separately (`profile` may be null for a moment). A failed or missing
  profile row never leaves the app on a spinner: show the page, and treat a missing
  profile as role customer with a one-line "finish your profile" notice. Guard against
  the sign-up trigger racing the first profile read by retrying that read once after 800 ms.
- Phone numbers: accept `0803 123 4567`, `08031234567`, `+234 803 123 4567` and
  `+2348031234567`; normalise to `+234...` before saving, and the validation message shows
  both accepted forms.
- Guests can browse; sign-in is asked for at the moment it is needed (checkout, booking,
  saving), with the reason in one line ("Sign in so you can track this order").
- Every auth error is shown in words a customer understands ("That password is wrong"),
  not the raw message. Buttons show a pending state while the call runs.

## Roles and row level security
- Hiding a link is not security; the policies are. Every table: `enable row level
  security`, then policies per role (patterns file has the set to copy).
- Customers read public data (products, services, availability), insert their own rows
  (orders, bookings, reviews) and read only their own (`auth.uid() = user_id`). They
  never update status.
- Staff and admin are decided by `public.is_staff()` / `public.is_admin()` functions
  that read `profiles.role` (security definer, so policies stay short). Admin writes
  products, prices, stock, settings; staff moves orders and bookings along.
- The admin account exists before the user ever opens the app: a `seed_admin` migration
  creates it (patterns file: `auth.users` + `auth.identities` with a bcrypt password, then
  the profile's role set to admin). Email: the owner's email from the spec, else
  `admin@<brand-slug>.app`. Password: generate one (12 characters, letters and digits),
  put it in `supabase/README.md`, and say it in the final reply with "change it after
  your first sign-in". Also keep `promote_first_admin` for a user who signs up themselves.
- `/admin` is the owner's front door and the only owner route prefix. Signed out, `/admin`
  renders the admin sign-in form (email, password, the brand mark, "Owner access"); signed
  in as admin or staff it renders the dashboard; signed in as anyone else it says "This
  account is not an admin" with a sign-out button. Sub-pages: `/admin/orders`,
  `/admin/customers`, `/admin/riders` (or vendors, staff), `/admin/settings`. Not linked
  from the customer nav; at most "Owner sign in" in the footer.
- Anon (signed out) may read public tables and insert a guest order only if the spec allows
  guest checkout; otherwise checkout requires sign-in.

## Data
- Every table: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz
  default now()`, `updated_at` kept by the shared trigger, and an owner column
  (`user_id`) where a row belongs to someone. Indexes on every foreign key and on the
  columns you filter by (`status`, `user_id`, `category`, `starts_at`).
- Money is `integer` in kobo (`amount_kobo`, `price_kobo`), never float. Show it with
  `naira()`. Phone numbers as text, formatted with `phone()`.
- Seed data lives in a migration (`seed_products`), with the same minimums as the design
  recipe (8 to 12 products or services with real names, prices, descriptions and images
  from public/uploads). The app never seeds on the client. Every image path in a seed
  must be a file that exists: `list_files public/uploads` first and reuse pictures across
  rows when the picture budget is spent; a row pointing at a picture that was never made
  is a broken card on every screen. Any `<img>` bound to data has an `onError` fallback
  (a tinted tile with the item's initial), so a missing file can never show alt text.
- Reads go through `db.ts` with the row types; lists are paginated (`range(from, to)`,
  page size 24) with a "Load more" button, searched with `ilike`, sorted deliberately.
- Every list screen has loading, empty and error states; every write shows a pending
  button, then a toast. Optimistic updates only for toggles; for orders and bookings
  wait for the server and re-read the row.
- Uploads by the app's users (product photos from admin, receipts, avatars) go to a
  Supabase Storage bucket created in a migration with its own policies, `public` only
  for product images. Store the path, not the file, in the row.

## Orders, bookings and anything with a lifecycle
- Model it as a state machine and write it down in `types.ts`:
  orders `pending -> paid -> confirmed -> fulfilled` with `cancelled` and `failed` as exits;
  bookings `requested -> confirmed -> completed` with `cancelled` and `no_show`.
- Transitions happen through one SQL function (`advance_order(id, next)`) that checks the
  move is allowed and the caller's role, writes the row and an `order_events` row (who,
  when, from, to, note). The app calls `rpc("advance_order", ...)`; it never sets `status`
  with an update.
- Customers see a timeline of their order's events on its page; admin sees a table with
  filters by status, a detail drawer and the allowed next-step buttons only.
- Stock: decrement in the same transaction that confirms the order (the SQL function),
  never from the browser. Sold-out items cannot be added.
- Unique things stay unique with constraints (`unique (slot_id)` for bookings, `unique
  (order_id, product_id)` for lines), so a double tap cannot double-book. Disable the
  submit button while a write is in flight and generate the order id on the client
  (`crypto.randomUUID()`) so a retry is idempotent.

## Server-side work (edge functions)
- Anything with a secret or that must be trusted runs in an edge function
  (`deploy_edge_function`): payment verification and webhooks, sending email or SMS,
  calling any paid API, generating receipts. Secrets go through `set_secret`; the
  function reads `Deno.env.get`. The service-role client exists only inside functions.
- A function validates its input (types, required fields, sane amounts) before touching
  the database and answers JSON with a clear `error` on failure. CORS headers on every
  response and an `OPTIONS` handler when the browser calls it.
- The app calls functions with `supabase.functions.invoke(name, { body })`, which sends
  the user's JWT; use `verify_jwt: false` only for webhooks from third parties, and then
  verify their signature instead.

## Real-world edges
- Time: store `timestamptz`, display in Africa/Lagos with `Intl.DateTimeFormat`. Booking
  slots are generated from opening hours in the spec, skipping past times and taken slots.
- Checkout and booking forms are pre-filled from the signed-in profile (name, phone,
  email) and the last used address; the user edits, never retypes. Saved addresses are a
  table with a `label` and a "use this" choice at checkout.
- Every list screen fetches inside `useEffect` with a cancelled flag, sets `loading`
  false in a `finally`, and shows the friendly error with a retry when the read fails; a
  page must never spin forever because a query threw, returned nothing, or a filter
  excluded every row (that is the empty state, not loading).
- Forms validate on the client (required, formats, minimums) and the database enforces
  the same with `check` constraints. Show the field error under the field.
- Errors are never shown raw. One helper (`friendlyError(e)` in `src/lib/errors.ts`)
  maps what Supabase returns to a sentence a customer understands: a missing table or
  "schema cache" (the migrations have not run) becomes "This app's database is not set up
  yet" for the owner and "We are finishing setup, please try again shortly" for a customer;
  a network failure "You seem to be offline"; a policy rejection "You do not have access to
  that"; anything else "Something went wrong. Please try again." Log the real error to the
  console. Never render `error.message` from a query in the page.
- Network: a failed read shows a retry button, not a blank page. Realtime
  (`supabase.channel(...).on("postgres_changes")`) for the admin orders table so a new
  order appears without refresh.
- Naira, WhatsApp contact, Nigerian phone formats and place names when the spec is Nigerian.

## Definition of done (check before you reply)
1. Sign up, sign in, sign out, reset password all work, and the session survives reload.
2. A new customer can do the main thing (order, book, post) end to end and see it in
   their account afterwards.
3. A rider (or partner) can apply through the site, sees the "being reviewed" screen,
   and the owner approves them from `/admin`; after approval they reach their dashboard.
4. Sign out works from the header on desktop and phone; the auth spinner never sticks.
5. The owner signs in at the Owner sign-in page, lands in `/admin`, sees that order or
   booking, and moves it to the next state; the customer's page reflects it.
6. Signed-out visitors and customers cannot read or change what is not theirs: every
   table has RLS with policies, and admin writes fail for a customer (the policies, not
   the UI, stop them).
7. No `any`, no `service_role` key anywhere in src/, no secret in .env or code.
8. The final reply tells the user, in plain words, how to sign in as owner and, when a
   webhook or secret is involved, exactly what to add in the third party's dashboard.
