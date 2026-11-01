-- Room Expense Manager schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;
create type app_role as enum ('admin','viewer');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text, role app_role not null default 'viewer', created_at timestamptz default now());
create table rooms (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now());
create table room_members (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms on delete cascade,
  name text not null, phone text, monthly_target numeric(12,2) not null default 0 check (monthly_target >= 0),
  active boolean not null default true, created_at timestamptz default now());
create table categories (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms on delete cascade,
  name text not null, created_at timestamptz default now(), unique (room_id, name));
create table expenses (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms on delete cascade,
  expense_date date not null, product text not null, category_id uuid references categories on delete set null,
  quantity numeric(12,3) not null check (quantity > 0), unit text not null default 'pcs',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  purchased_by uuid references room_members on delete set null, vendor text, notes text,
  created_at timestamptz default now());
create table contributions (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms on delete cascade,
  member_id uuid not null references room_members on delete restrict,
  amount numeric(12,2) not null check (amount > 0), paid_on date not null,
  method text not null default 'UPI', reference text, notes text, created_at timestamptz default now());
create table monthly_budgets (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms on delete cascade,
  month date not null check (extract(day from month) = 1), amount numeric(12,2) not null check (amount >= 0),
  unique (room_id, month));
create table monthly_closings (  -- snapshot written when admin closes a month
  id uuid primary key default gen_random_uuid(), room_id uuid not null references rooms on delete cascade,
  month date not null check (extract(day from month) = 1),
  opening_balance numeric(14,2) not null, contributions numeric(14,2) not null,
  expenses numeric(14,2) not null, closing_balance numeric(14,2) not null,
  closed_at timestamptz default now(), unique (room_id, month));

create index on expenses (room_id, expense_date);
create index on contributions (room_id, paid_on);

-- Auto-create a VIEWER profile for every new auth user
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
create function is_user() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid()) $$;

-- RLS: every signed-in user can read; only ADMIN can write.
do $$ declare t text; begin
  foreach t in array array['rooms','room_members','categories','expenses','contributions','monthly_budgets','monthly_closings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read" on %I for select to authenticated using (is_user())', t);
    execute format('create policy "ins" on %I for insert to authenticated with check (is_admin())', t);
    execute format('create policy "upd" on %I for update to authenticated using (is_admin()) with check (is_admin())', t);
    execute format('create policy "del" on %I for delete to authenticated using (is_admin())', t);
  end loop; end $$;

alter table profiles enable row level security;
create policy "own or admin read" on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy "admin update" on profiles for update to authenticated using (is_admin()) with check (is_admin());

-- Seed one room + default categories
with r as (insert into rooms (name) values ('My Room') returning id)
insert into categories (room_id, name) select r.id, c from r,
  unnest(array['Groceries','Vegetables','Milk','Gas','Electricity','Water','Internet','Cleaning','Rent','Other']) c;

-- AFTER signing up, promote yourself (replace email):
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
