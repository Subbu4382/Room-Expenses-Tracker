import { useEffect, useState } from 'react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { clearViewToken, fetchAll, supabase } from '../lib/supabase'
import { downloadFile } from '../lib/export'
import { currentMonth, fmtMonth, monthStart } from '../lib/format'
import { confirmDelete, Btn, ErrorMsg, Field, PageHead } from '../components/ui'
import { Profile } from '../lib/types'

const TABLES: [string, string][] = [['categories', 'created_at'], ['room_members', 'created_at'], ['expenses', 'expense_date'], ['contributions', 'paid_on'], ['monthly_budgets', 'month'], ['monthly_closings', 'month']]

export default function Settings() {
  const { room, categories, budgets, reload } = useData()
  const { isAdmin, profile, session, signOut } = useAuth()
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const [bMonth, setBMonth] = useState(currentMonth()); const [bAmt, setBAmt] = useState('')
  const [newCat, setNewCat] = useState(''); const [users, setUsers] = useState<Profile[]>([])

  useEffect(() => { setBAmt(String(budgets.find(b => b.month === monthStart(bMonth))?.amount ?? '')) }, [bMonth, budgets])
  const loadUsers = () => supabase.from('profiles').select('*').order('created_at').then(({ data }) => setUsers((data ?? []) as Profile[]))
  useEffect(() => { if (isAdmin) loadUsers() }, [isAdmin])
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { setErr(''); setMsg(''); const { error } = await p; if (error) setErr(error.message); else { setMsg(ok); await reload() } }

  const saveBudget = () => Number(bAmt) >= 0 && bAmt !== '' ? run(supabase.from('monthly_budgets').upsert({ room_id: room!.id, month: monthStart(bMonth), amount: Number(bAmt) }, { onConflict: 'room_id,month' }), 'Budget saved') : setErr('Enter a valid budget')
  const addCat = () => newCat.trim() ? run(supabase.from('categories').insert({ room_id: room!.id, name: newCat.trim() }), 'Category added').then(() => setNewCat('')) : setErr('Enter a category name')
  const renameCat = (id: string, old: string) => { const n = window.prompt('Rename category', old); if (n && n.trim() && n !== old) run(supabase.from('categories').update({ name: n.trim() }).eq('id', id), 'Category renamed') }
  const delCat = (id: string, name: string) => confirmDelete(`category "${name}" (its expenses become uncategorised)`) && run(supabase.from('categories').delete().eq('id', id), 'Category deleted')
  const setRole = (id: string, role: string) => run(supabase.from('profiles').update({ role }).eq('id', id), 'Role updated').then(() => setUsers(u => u.map(x => x.id === id ? { ...x, role: role as Profile['role'] } : x)))

  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'viewer' }); const [userBusy, setUserBusy] = useState(false)
  async function callUsers(body: Record<string, unknown>): Promise<string | null> {
    const { data, error } = await supabase.functions.invoke('manage-users', { body })
    if (error) { let m = error.message; try { const j = await (error as any).context.json(); if (j?.error) m = j.error } catch { /* keep generic message */ } return m }
    return data?.error ?? null
  }
  async function addUser() {
    if (!/^\S+@\S+\.\S+$/.test(nu.email)) return setErr('Enter a valid email')
    if (nu.password.length < 6) return setErr('Password must be at least 6 characters')
    setUserBusy(true); setErr(''); setMsg('')
    const m = await callUsers({ action: 'create', ...nu }); setUserBusy(false)
    if (m) return setErr(m)
    setMsg(`User ${nu.email} added`); setNu({ name: '', email: '', password: '', role: 'viewer' }); loadUsers()
  }
  async function resetPw(u: Profile) {
    const p = window.prompt(`New password for ${u.full_name ?? 'this user'} (min 6 characters)`)
    if (!p) return
    if (p.length < 6) return setErr('Password must be at least 6 characters')
    const m = await callUsers({ action: 'reset_password', id: u.id, password: p }); if (m) setErr(m); else { setErr(''); setMsg('Password updated') }
  }
  async function delUser(u: Profile) {
    if (!confirmDelete(`user "${u.full_name ?? 'this user'}" (their personal expenses are deleted too)`)) return
    const m = await callUsers({ action: 'delete', id: u.id }); if (m) setErr(m); else { setErr(''); setMsg('User deleted'); loadUsers() }
  }

  const [link, setLink] = useState('')
  useEffect(() => { if (isAdmin) supabase.from('viewer_link').select('token').maybeSingle().then(({ data }) => setLink(data?.token ? `${window.location.origin}/#view=${data.token}` : '')) }, [isAdmin])
  async function genLink() {
    if (link && !window.confirm('Generate a new link? The old link stops working for everyone.')) return
    const token = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('')
    const { error } = await supabase.from('viewer_link').upsert({ id: 1, token, updated_at: new Date().toISOString() })
    if (error) return setErr(error.message + ' (Did you run supabase/migration_viewer_link.sql?)')
    setErr(''); setLink(`${window.location.origin}/#view=${token}`); setMsg('Viewer link ready - copy it below')
  }
  async function revokeLink() {
    if (!window.confirm('Turn off the viewer link? Nobody can open the site without signing in.')) return
    const { error } = await supabase.from('viewer_link').delete().eq('id', 1)
    if (error) setErr(error.message); else { setLink(''); setMsg('Viewer link turned off') }
  }
  async function copyLink() { try { await navigator.clipboard.writeText(link); setMsg('Link copied') } catch { setErr('Copy failed - select the link and copy it manually') } }

  async function backup() {
    try { const out: Record<string, unknown> = { version: 1, exported_at: new Date().toISOString() }
      for (const [t, o] of TABLES) out[t] = await fetchAll(t, o)
      downloadFile(`room-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2), 'application/json')
    } catch (e: any) { setErr(e.message) } }

  async function restore(file: File) {
    if (!window.confirm('Restore will merge/overwrite records with the same IDs from this backup. Continue?')) return
    try {
      const data = JSON.parse(await file.text()); setErr('')
      for (const [t] of TABLES) {
        let rows: Record<string, unknown>[] = data[t] ?? []
        if (t === 'expenses') rows = rows.map(({ total, ...r }) => r) // total is a generated column
        for (let i = 0; i < rows.length; i += 500) { const { error } = await supabase.from(t).upsert(rows.slice(i, i + 500), { onConflict: 'id' }); if (error) throw new Error(`${t}: ${error.message}`) }
      }
      setMsg('Backup restored'); await reload()
    } catch (e: any) { setErr('Restore failed: ' + e.message) } }

  return (
    <div className="space-y-4">
      <PageHead title="Settings" />
      <ErrorMsg text={err} />{msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
      <div className="card"><h2 className="font-semibold">Account</h2>{session
        ? <><p className="text-sm text-gray-600">{session.user.email} - {profile?.role.toUpperCase()}</p><Btn variant="ghost" className="mt-2" onClick={signOut}>Sign out</Btn></>
        : <><p className="text-sm text-gray-600">Viewing through a shared link (read-only).</p><Btn variant="ghost" className="mt-2" onClick={clearViewToken}>Admin sign in</Btn></>}</div>

      {isAdmin && <>
        <div className="card"><h2 className="mb-1 font-semibold">Viewer link</h2>
          <p className="mb-2 text-xs text-gray-500">Roommates who open this link see everything read-only, with no sign-in. Anyone with the link can view, so share it only with roommates. Generate it while on your live site so the address is correct.</p>
          {link && <input readOnly className="input mb-2" value={link} onFocus={e => e.target.select()} />}
          <div className="flex flex-wrap gap-2"><Btn variant="blue" onClick={genLink}>{link ? 'Regenerate link' : 'Generate link'}</Btn>
            {link && <><Btn variant="ghost" onClick={copyLink}>Copy</Btn><Btn variant="danger" onClick={revokeLink}>Turn off</Btn></>}</div></div>
        <div className="card"><h2 className="mb-2 font-semibold">Monthly budget</h2>
          <div className="grid grid-cols-2 gap-2"><Field label="Month"><input type="month" className="input" value={bMonth} onChange={e => e.target.value && setBMonth(e.target.value)} /></Field>
            <Field label="Budget (INR)"><input type="number" min="0" className="input" value={bAmt} onChange={e => setBAmt(e.target.value)} /></Field></div>
          <Btn className="mt-2" onClick={saveBudget}>Save budget for {fmtMonth(bMonth)}</Btn></div>

        <div className="card"><h2 className="mb-2 font-semibold">Categories</h2>
          <div className="flex gap-2"><input className="input" placeholder="New category" value={newCat} onChange={e => setNewCat(e.target.value)} /><Btn onClick={addCat}>Add</Btn></div>
          <div className="mt-2 divide-y text-sm">{categories.map(c => <div key={c.id} className="flex items-center justify-between py-2"><span>{c.name}</span>
            <span className="flex gap-3"><button className="text-royal" onClick={() => renameCat(c.id, c.name)}>Rename</button><button className="text-red-600" onClick={() => delCat(c.id, c.name)}>Delete</button></span></div>)}</div></div>

        <div className="card"><h2 className="mb-1 font-semibold">Users &amp; access</h2>
          <p className="mb-2 text-xs text-gray-500">Add roommates here. Viewers are read-only; admins have full access. Only admins see this section.</p>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Name" value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} />
            <input className="input" type="email" placeholder="Email" value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} />
            <input className="input" placeholder="Password (min 6)" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} />
            <select className="input" value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value })}><option value="viewer">Viewer</option><option value="admin">Admin</option></select></div>
          <Btn className="mt-2" onClick={addUser} disabled={userBusy}>{userBusy ? 'Adding...' : 'Add user'}</Btn>
          <div className="mt-3 divide-y">{users.map(u => <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0 truncate font-medium">{u.full_name ?? u.id.slice(0, 8)}{u.id === profile?.id && ' (you)'}</span>
            <span className="flex items-center gap-2"><select className="input w-auto" value={u.role} disabled={u.id === profile?.id} onChange={e => setRole(u.id, e.target.value)}><option value="viewer">Viewer</option><option value="admin">Admin</option></select>
              <button className="text-royal" onClick={() => resetPw(u)}>Reset password</button>
              {u.id !== profile?.id && <button className="text-red-600" onClick={() => delUser(u)}>Delete</button>}</span></div>)}</div></div>
      </>}

      <div className="card"><h2 className="mb-2 font-semibold">Backup &amp; restore</h2>
        <div className="flex flex-wrap items-center gap-2"><Btn variant="blue" onClick={backup}>Download backup (JSON)</Btn>
          {isAdmin && <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium">Restore from file<input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = '' }} /></label>}</div></div>
    </div>)
}
