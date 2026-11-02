// Edge Function: admin-only user management. Deploy as "manage-users".
   // @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // The service-role key lives only here (auto-provided by Supabase), never in the website.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1) Who is calling?
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Not signed in' }, 401)

    // 2) Are they an admin?
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (me?.role !== 'admin') return json({ error: 'Only admins can manage users' }, 403)

    const b = await req.json()

    if (b.action === 'create') {
      const email = String(b.email ?? '').trim().toLowerCase()
      const password = String(b.password ?? '')
      const role = b.role === 'admin' ? 'admin' : 'viewer'
      const name = String(b.name ?? '').trim() || email
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Enter a valid email' }, 400)
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } })
      if (error) return json({ error: error.message }, 400)
      if (role === 'admin') await admin.from('profiles').update({ role }).eq('id', data.user.id)
      return json({ ok: true, id: data.user.id })
    }

    if (b.action === 'reset_password') {
      if (String(b.password ?? '').length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
      const { error } = await admin.auth.admin.updateUserById(String(b.id), { password: String(b.password) })
      return error ? json({ error: error.message }, 400) : json({ ok: true })
    }

    if (b.action === 'delete') {
      if (b.id === user.id) return json({ error: 'You cannot delete your own account' }, 400)
      const { error } = await admin.auth.admin.deleteUser(String(b.id))
      return error ? json({ error: error.message }, 400) : json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
