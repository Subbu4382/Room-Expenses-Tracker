import { FormEvent, useState } from 'react'
import { BarChart3, CalendarDays, Home, Menu, PiggyBank, Receipt, Settings as Cog, Users, X } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import { DataProvider, useData } from './lib/data'
import { configured, supabase } from './lib/supabase'
import { Btn, ErrorMsg } from './components/ui'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Members from './pages/Members'
import Contributions from './pages/Contributions'
import Reports from './pages/Reports'
import History from './pages/History'
import SettingsPage from './pages/Settings'

const PAGES = [
  { id: 'dash', label: 'Dashboard', icon: Home, C: Dashboard }, { id: 'exp', label: 'Expenses', icon: Receipt, C: Expenses },
  { id: 'con', label: 'Contributions', icon: PiggyBank, C: Contributions }, { id: 'mem', label: 'Members', icon: Users, C: Members },
  { id: 'rep', label: 'Reports', icon: BarChart3, C: Reports }, { id: 'his', label: 'History', icon: CalendarDays, C: History },
  { id: 'set', label: 'Settings', icon: Cog, C: SettingsPage }]

function Login() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr(error.message); setBusy(false)
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-bold"><span className="text-brand">Room</span> <span className="text-royal">Expenses</span></h1>
        <input className="input" type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" required value={pw} onChange={e => setPw(e.target.value)} />
        <ErrorMsg text={err} /><Btn className="w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Btn>
      </form>
    </div>)
}

function Shell() {
  const [page, setPage] = useState('dash'); const [open, setOpen] = useState(false)
  const { profile } = useAuth(); const { loading, error } = useData()
  const Cur = PAGES.find(p => p.id === page)!.C
  const nav = (
    <nav className="space-y-1 p-3">{PAGES.map(p => (
      <button key={p.id} onClick={() => { setPage(p.id); setOpen(false) }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${page === p.id ? 'bg-brand text-white' : 'text-gray-700 hover:bg-orange-50'}`}>
        <p.icon size={18} />{p.label}</button>))}</nav>)
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="hidden w-56 shrink-0 border-r bg-white md:block"><div className="p-4 text-lg font-bold"><span className="text-brand">Room</span> <span className="text-royal">Expenses</span></div>{nav}
        <p className="p-4 text-xs text-gray-500">Role: {profile?.role}</p></aside>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-white p-3 md:hidden">
        <span className="font-bold"><span className="text-brand">Room</span> <span className="text-royal">Expenses</span></span>
        <button aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></header>
      {open && <div className="fixed inset-x-0 top-12 z-30 border-b bg-white shadow md:hidden">{nav}</div>}
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        {loading ? <p className="py-20 text-center text-gray-500">Loading...</p> : error ? <ErrorMsg text={error} /> : <Cur />}</main>
    </div>)
}

function Gate() {
  const { session, profile, loading, signOut } = useAuth()
  if (!configured) return <div className="p-6 text-sm"><b>Missing configuration.</b> Copy <code>.env.example</code> to <code>.env</code> and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div>
  if (loading) return <p className="py-20 text-center text-gray-500">Loading...</p>
  if (!session) return <Login />
  if (!profile) return <div className="p-6 text-sm">No profile for this account. <Btn variant="ghost" onClick={signOut}>Sign out</Btn></div>
  return <DataProvider><Shell /></DataProvider>
}
export default function App() { return <AuthProvider><Gate /></AuthProvider> }
