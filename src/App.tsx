import { FormEvent, useState } from 'react'
import { BarChart3, CalendarDays, Home, MoreHorizontal, PiggyBank, Receipt, Settings as Cog, Users, Wallet, X } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import { DataProvider, useData } from './lib/data'
import { clearViewToken, configured, supabase, viewToken } from './lib/supabase'
import { Btn, ErrorMsg } from './components/ui'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Members from './pages/Members'
import Contributions from './pages/Contributions'
import Reports from './pages/Reports'
import History from './pages/History'
import Personal from './pages/Personal'
import SettingsPage from './pages/Settings'

const PAGES = [
  { id: 'dash', label: 'Dashboard', short: 'Home', icon: Home, C: Dashboard }, { id: 'exp', label: 'Expenses', short: 'Expenses', icon: Receipt, C: Expenses },
  { id: 'con', label: 'Contributions', short: 'Payments', icon: PiggyBank, C: Contributions }, { id: 'mem', label: 'Members', short: 'Members', icon: Users, C: Members },
  { id: 'rep', label: 'Reports', short: 'Reports', icon: BarChart3, C: Reports }, { id: 'his', label: 'History', short: 'History', icon: CalendarDays, C: History },
  { id: 'per', label: 'Personal Expenses', short: 'Personal', icon: Wallet, C: Personal }, { id: 'set', label: 'Settings', short: 'Settings', icon: Cog, C: SettingsPage }]
const TABS = ['dash', 'exp', 'con', 'per'] // shown on the mobile bottom bar; the rest live under "More"

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
        <h1 className="text-2xl font-bold"><span className="inline-flex items-center gap-2"><img src="/favicon.svg" alt="" className="h-7 w-7" /><span><span className="text-brand">Room</span> <span className="text-royal">Expenses</span></span></span></h1>
        <input className="input" type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" required value={pw} onChange={e => setPw(e.target.value)} />
        <ErrorMsg text={err} /><Btn className="w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Btn>
      </form>
    </div>)
}

function Shell() {
  const [page, setPage] = useState('dash'); const [more, setMore] = useState(false)
  const { profile, session } = useAuth(); const { loading, error } = useData()
  const Cur = PAGES.find(p => p.id === page)!.C
  const go = (id: string) => { setPage(id); setMore(false); window.scrollTo({ top: 0 }) }
  const tabs = PAGES.filter(p => TABS.includes(p.id)); const extras = PAGES.filter(p => !TABS.includes(p.id))
  const logo = <span className="inline-flex items-center gap-2"><img src="/favicon.svg" alt="" className="h-7 w-7" /><span><span className="text-brand">Room</span> <span className="text-royal">Expenses</span></span></span>
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="hidden w-56 shrink-0 border-r bg-white md:block"><div className="p-4 text-lg font-bold">{logo}</div>
        <nav className="space-y-1 p-3">{PAGES.map(p => (
          <button key={p.id} onClick={() => go(p.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${page === p.id ? 'bg-brand text-white' : 'text-gray-700 hover:bg-orange-50'}`}>
            <p.icon size={18} />{p.label}</button>))}</nav>
        <p className="p-4 text-xs text-gray-500">Role: {profile?.role ?? 'viewer'}</p></aside>

      <header className="sticky top-0 z-30 border-b bg-white p-3 font-bold md:hidden">{logo}</header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:pb-4">
        {loading ? <p className="py-20 text-center text-gray-500">Loading...</p> : error ? <div className="space-y-3"><ErrorMsg text={error} />{viewToken && !session && <Btn variant="ghost" onClick={clearViewToken}>Clear link / admin sign in</Btn>}</div> : <Cur />}</main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(p => { const on = page === p.id; return (
          <button key={p.id} onClick={() => go(p.id)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${on ? 'text-brand' : 'text-gray-500'}`}>
            <p.icon size={22} strokeWidth={on ? 2.5 : 2} />{p.short}</button>) })}
        <button onClick={() => setMore(true)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${extras.some(e => e.id === page) ? 'text-brand' : 'text-gray-500'}`}>
          <MoreHorizontal size={22} />More</button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">More</h3><button aria-label="Close" onClick={() => setMore(false)}><X size={20} /></button></div>
            <div className="grid grid-cols-2 gap-2">{extras.map(p => (
              <button key={p.id} onClick={() => go(p.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-medium ${page === p.id ? 'border-brand bg-orange-50 text-brand' : 'border-gray-200 text-gray-700'}`}>
                <p.icon size={20} />{p.label}</button>))}</div>
          </div>
        </div>)}
    </div>)
}

function Gate() {
  const { session, profile, loading, signOut } = useAuth()
  if (!configured) return <div className="p-6 text-sm"><b>Missing configuration.</b> Copy <code>.env.example</code> to <code>.env</code> and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div>
  if (loading) return <p className="py-20 text-center text-gray-500">Loading...</p>
  if (!session && viewToken) return <DataProvider><Shell /></DataProvider>
  if (!session) return <Login />
  if (!profile) return <div className="p-6 text-sm">No profile for this account. <Btn variant="ghost" onClick={signOut}>Sign out</Btn></div>
  return <DataProvider><Shell /></DataProvider>
}
export default function App() { return <AuthProvider><Gate /></AuthProvider> }
