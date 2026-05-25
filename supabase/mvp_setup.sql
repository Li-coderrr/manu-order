create table if not exists public.orders (
  id bigint generated always as identity primary key,
  customer text,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  created_at timestamp not null default now()
);

alter table public.orders enable row level security;
alter table public.orders replica identity full;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.orders to anon, authenticated;
grant usage, select on sequence public.orders_id_seq to anon, authenticated;

drop policy if exists "orders_select_all" on public.orders;
create policy "orders_select_all"
on public.orders
for select
to anon, authenticated
using (true);

drop policy if exists "orders_insert_all" on public.orders;
create policy "orders_insert_all"
on public.orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "orders_update_all" on public.orders;
create policy "orders_update_all"
on public.orders
for update
to anon, authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;
