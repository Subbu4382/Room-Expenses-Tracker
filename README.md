# Room Expense Manager

React + TypeScript + Tailwind + Supabase (Auth, Postgres, RLS) + Recharts + jsPDF.

## Setup
1. Create a Supabase project.
2. SQL Editor -> run `supabase/schema.sql` (tables, RLS, trigger, seed room + categories).
3. Authentication -> Users -> add yourself and each roommate (email + password). Then turn OFF public signups (Auth settings).
4. Promote yourself to admin (SQL Editor, your email):
   `update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`
   Everyone else stays VIEWER (read-only). Roles can later be changed in Settings.
5. `cp .env.example .env` and fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (Project Settings -> API; anon key only, never the service_role key).
6. `npm install && npm run dev`. Deploy with `npm run build` (Vercel/Netlify; set the same two env vars).

## Notes
- Permissions: viewers can SELECT only; INSERT/UPDATE/DELETE policies require is_admin(), enforced in Postgres.
- All totals are calculated from database rows (src/lib/calc.ts).
- PDFs show "Rs." because jsPDF's built-in fonts lack the rupee glyph. CSVs are UTF-8 with BOM and open in Excel.
