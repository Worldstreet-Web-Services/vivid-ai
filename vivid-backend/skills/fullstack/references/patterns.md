# Patterns to copy

Reuse these as written; change names, not shape.

## Migration: profiles, roles, shared triggers (`create_profiles`)
```sql
create type public.app_role as enum ('customer', 'staff', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff', 'admin'))
$$;

create policy "read own profile" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "update own profile" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "admin manages roles" on public.profiles for update using (public.is_admin());
```
Owner from the spec: `update public.profiles p set role = 'admin' from auth.users u where u.id = p.id and u.email = 'owner@example.com';`
No email known (`promote_first_admin`):
```sql
update public.profiles set role = 'admin'
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');
```

## Migration: a public table with an owner (`create_orders`)
```sql
create type public.order_status as enum ('pending','paid','confirmed','fulfilled','cancelled','failed');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  phone text not null,
  address text,
  amount_kobo integer not null check (amount_kobo >= 0),
  status public.order_status not null default 'pending',
  reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_kobo integer not null check (unit_kobo >= 0),
  unique (order_id, product_id)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor uuid references auth.users(id),
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;

create policy "customer inserts own order" on public.orders for insert
  with check (user_id = auth.uid() and status = 'pending');
create policy "customer reads own orders" on public.orders for select
  using (user_id = auth.uid() or public.is_staff());
create policy "items follow order" on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid() and o.status = 'pending'));
create policy "events follow order" on public.order_events for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
```
Products: `select` for everyone (`using (true)`), `insert/update/delete` with `public.is_admin()`.
Guest checkout allowed by the spec: insert policy `with check ((user_id = auth.uid() or user_id is null) and status = 'pending')` and read by `reference` through an edge function, not a policy.

## Migration: transitions as one function (`advance_order`)
```sql
create or replace function public.advance_order(p_order uuid, p_next public.order_status, p_note text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare cur public.orders; allowed boolean;
begin
  select * into cur from public.orders where id = p_order for update;
  if not found then raise exception 'order not found'; end if;
  allowed := case
    when cur.status = 'pending'   and p_next in ('paid','cancelled','failed') then true
    when cur.status = 'paid'      and p_next in ('confirmed','cancelled')     then true
    when cur.status = 'confirmed' and p_next in ('fulfilled','cancelled')     then true
    else false end;
  if not allowed then raise exception 'cannot move % to %', cur.status, p_next; end if;
  if p_next = 'cancelled' and not (public.is_staff() or (cur.user_id = auth.uid() and cur.status = 'pending')) then
    raise exception 'not allowed'; end if;
  if p_next in ('confirmed','fulfilled') and not public.is_staff() then raise exception 'not allowed'; end if;
  if p_next = 'paid' and auth.role() <> 'service_role' then raise exception 'payments are confirmed by the server'; end if;
  if p_next = 'confirmed' then
    update public.products p set stock = p.stock - i.quantity
      from public.order_items i where i.order_id = cur.id and p.id = i.product_id;
  end if;
  update public.orders set status = p_next where id = cur.id returning * into cur;
  insert into public.order_events (order_id, actor, from_status, to_status, note)
    values (cur.id, auth.uid(), cur.status, p_next, p_note);
  return cur;
end $$;
```
Bookings: same shape with `booking_status` and `unique (slot_starts_at, staff_id)` on the table.

## Migration: storage bucket for user uploads (`create_uploads_bucket`)
```sql
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
  on conflict (id) do nothing;
create policy "anyone reads product images" on storage.objects for select using (bucket_id = 'product-images');
create policy "admin writes product images" on storage.objects for all
  using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
```
Upload: `supabase.storage.from("product-images").upload(path, file, { upsert: true })`, then
`getPublicUrl(path).data.publicUrl` in the row.

## src/auth/AuthProvider.tsx
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type Auth = {
  user: User | null; profile: Profile | null; loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};
const Ctx = createContext<Auth | null>(null);

const friendly = (m: string) =>
  /invalid login/i.test(m) ? "That email or password is wrong." :
  /already registered/i.test(m) ? "There is already an account with that email. Sign in instead." :
  /password/i.test(m) ? "Use at least 8 characters for the password." : "Something went wrong. Please try again.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [session]);

  const value: Auth = {
    user: session?.user ?? null, profile, loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? friendly(error.message) : null;
    },
    signUp: async (email, password, full_name, phone) => {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } });
      return error ? friendly(error.message) : null;
    },
    signOut: async () => { await supabase.auth.signOut(); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
```

## src/auth/guards.tsx
```tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import type { Role } from "@/lib/types";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/sign-in" state={{ from: loc.pathname }} replace />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading || (user && !profile)) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/owner" state={{ from: loc.pathname }} replace />;
  return profile && roles.includes(profile.role) ? <Outlet /> : <Navigate to="/" replace />;
}
```
Routes: `<Route element={<RequireRole roles={["admin","staff"]} />}><Route path="/admin" element={<AdminLayout />}>…</Route></Route>`.
`/owner` is the owner's sign-in page (same form as sign-in, titled for the owner, linked only from the footer).

## src/lib/db.ts (shape)
```ts
import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus, Product } from "@/lib/types";

export const PAGE = 24;

export async function listProducts(opts: { page?: number; q?: string; category?: string } = {}) {
  const page = opts.page ?? 0;
  let query = supabase.from("products").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (opts.q) query = query.ilike("name", `%${opts.q}%`);
  if (opts.category) query = query.eq("category", opts.category);
  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []) as Product[], total: count ?? 0 };
}

export async function createOrder(input: { id: string; email: string; phone: string; address: string;
  items: { product_id: string; quantity: number; unit_kobo: number }[] }) {
  const amount_kobo = input.items.reduce((s, i) => s + i.quantity * i.unit_kobo, 0);
  const { data: { user } } = await supabase.auth.getUser();
  const { data: order, error } = await supabase.from("orders")
    .insert({ id: input.id, user_id: user?.id ?? null, email: input.email, phone: input.phone,
              address: input.address, amount_kobo, reference: input.id })
    .select().single();
  if (error) throw error;
  const { error: e2 } = await supabase.from("order_items")
    .insert(input.items.map((i) => ({ ...i, order_id: order.id })));
  if (e2) throw e2;
  return order as Order;
}

export async function advanceOrder(id: string, next: OrderStatus, note?: string) {
  const { data, error } = await supabase.rpc("advance_order", { p_order: id, p_next: next, p_note: note ?? null });
  if (error) throw error;
  return data as Order;
}
```
`src/lib/format.ts`: `export const naira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 });`

## Edge function skeleton (index.ts)
```ts
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: { orderId?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.orderId) return json({ error: "orderId required" }, 400);
  // work with `admin` here; never return the service key or raw errors
  return json({ ok: true });
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "content-type": "application/json" } });
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to every function; do not set them.

## Realtime for the admin orders table
```ts
useEffect(() => {
  const ch = supabase.channel("orders").on("postgres_changes",
    { event: "*", schema: "public", table: "orders" }, () => refetch()).subscribe();
  return () => { supabase.removeChannel(ch); };
}, [refetch]);
```
