-- Viewer link migration. Run ONCE in Supabase SQL Editor (after schema.sql).
create table if not exists viewer_link (
  id int primary key default 1 check (id = 1),
  token text not null check (length(token) >= 32),
  updated_at timestamptz default now());
alter table viewer_link enable row level security;
create policy "admin manages link" on viewer_link for all to authenticated
  using (is_admin()) with check (is_admin());

-- True only when the request carries the current secret token in the x-view-token header
create or replace function has_view_token() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from viewer_link
    where token = coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-view-token', ''))
$$;

-- Read-only access for anonymous visitors who hold the link. No write policies for anon.
do $$ declare t text; begin
  foreach t in array array['rooms','room_members','categories','expenses','contributions','monthly_budgets','monthly_closings'] loop
    execute format('create policy "read via link" on %I for select to anon using (has_view_token())', t);
  end loop; end $$;
