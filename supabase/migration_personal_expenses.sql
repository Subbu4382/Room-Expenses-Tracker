-- Personal expenses migration. Run ONCE in Supabase SQL Editor.
-- Each logged-in user (admin or viewer) sees ONLY their own rows.
create table if not exists personal_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  spent_on date not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz default now());
create index if not exists personal_expenses_user_date on personal_expenses (user_id, spent_on);
alter table personal_expenses enable row level security;
create policy "own select" on personal_expenses for select to authenticated using (user_id = auth.uid());
create policy "own insert" on personal_expenses for insert to authenticated with check (user_id = auth.uid());
create policy "own update" on personal_expenses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own delete" on personal_expenses for delete to authenticated using (user_id = auth.uid());
