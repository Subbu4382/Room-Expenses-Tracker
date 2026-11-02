import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Info, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fetchAll, supabase } from '../lib/supabase'
import { sum } from '../lib/calc'
import { downloadCsv } from '../lib/export'
import { currentMonth, fmtDate, fmtMonth, inr, monthEnd, monthStart, todayIST } from '../lib/format'
import { Btn, confirmDelete, Empty, ErrorMsg, PageHead } from '../components/ui'

interface Item { id: string; spent_on: string; description: string; amount: number }
type Row = Omit<Item, 'id'>
const LS = 'rem_personal_expenses'
const readLocal = (): Item[] => { try { return JSON.parse(localStorage.getItem(LS) ?? '[]') } catch { return [] } }
const writeLocal = (v: Item[]) => { try { localStorage.setItem(LS, JSON.stringify(v)) } catch { /* storage blocked */ } }

// Signed-in users: private rows in Supabase (RLS: own rows only).
// Viewer-link visitors have no account, so their entries stay on this device.
function usePersonal() {
  const { session } = useAuth()
  const cloud = Boolean(session)
  const [items, setItems] = useState<Item[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setItems(cloud ? await fetchAll<Item>('personal_expenses', 'spent_on') : readLocal()); setError('') }
    catch (e: any) { setError(e.message + (cloud ? ' (Did you run supabase/migration_personal_expenses.sql?)' : '')) }
    setLoading(false)
  }, [cloud])
  useEffect(() => { load() }, [load])

  async function save(row: Row, id?: string): Promise<string | null> {
    if (cloud) {
      const { error } = id ? await supabase.from('personal_expenses').update(row).eq('id', id) : await supabase.from('personal_expenses').insert(row)
      if (error) return error.message
      await load(); return null
    }
    const next = id ? items.map(i => i.id === id ? { ...i, ...row } : i) : [{ id: crypto.randomUUID(), ...row }, ...items]
    writeLocal(next); setItems(next); return null
  }
  async function remove(id: string): Promise<string | null> {
    if (cloud) {
      const { error } = await supabase.from('personal_expenses').delete().eq('id', id)
      if (error) return error.message
      await load(); return null
    }
    const next = items.filter(i => i.id !== id); writeLocal(next); setItems(next); return null
  }
  return { cloud, items, loading, error, save, remove }
}

export default function Personal() {
  const { cloud, items, loading, error, save, remove } = usePersonal()
  const today = todayIST()
  const [month, setMonth] = useState(currentMonth())
  const [desc, setDesc] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState(today)
  const [editId, setEditId] = useState<string | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  const from = monthStart(month), to = monthEnd(month)
  const monthItems = useMemo(() => items.filter(i => i.spent_on >= from && i.spent_on <= to), [items, from, to])
  const todayTotal = sum(items.filter(i => i.spent_on === today).map(i => i.amount))
  const monthTotal = sum(monthItems.map(i => i.amount))
  const daysCount = month === currentMonth() ? Number(today.slice(8)) : Number(to.slice(8))
  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    monthItems.forEach(i => m.set(i.spent_on, [...(m.get(i.spent_on) ?? []), i]))
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [monthItems])
  const chart = Array.from({ length: Number(to.slice(8)) }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`
    return { day: String(i + 1), amount: sum(monthItems.filter(x => x.spent_on === d).map(x => x.amount)) }
  })
  const allMonths = useMemo(() => { const s = new Set(items.map(i => i.spent_on.slice(0, 7))); s.add(currentMonth()); return [...s].sort().reverse() }, [items])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!desc.trim()) return setErr('Enter what you spent on')
    if (!(amt > 0)) return setErr('Enter an amount greater than 0')
    if (!date) return setErr('Pick a date')
    setBusy(true)
    const msg = await save({ spent_on: date, description: desc.trim(), amount: amt }, editId ?? undefined)
    setBusy(false)
    if (msg) return setErr(msg)
    setErr(''); setDesc(''); setAmount(''); setEditId(null); setMonth(date.slice(0, 7)); setDate(today)
  }
  function startEdit(i: Item) { setEditId(i.id); setDesc(i.description); setAmount(String(i.amount)); setDate(i.spent_on); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function cancelEdit() { setEditId(null); setDesc(''); setAmount(''); setDate(today); setErr('') }
  async function del(i: Item) {
    if (!confirmDelete(`"${i.description}"`)) return
    const msg = await remove(i.id); if (msg) setErr(msg)
  }
  const exportCsv = () => downloadCsv(`personal_${month}.csv`, [['Date', 'Description', 'Amount'],
    ...[...monthItems].sort((a, b) => a.spent_on.localeCompare(b.spent_on)).map(i => [fmtDate(i.spent_on), i.description, i.amount])])

  return (
    <div>
      <PageHead title="Personal expenses">
        <input type="month" className="input w-auto" value={month} onChange={e => e.target.value && setMonth(e.target.value)} />
        <Btn variant="ghost" onClick={exportCsv} disabled={monthItems.length === 0}><Download size={16} />CSV</Btn>
      </PageHead>

      <div className="mb-4 flex items-start gap-2 rounded-lg bg-orange-50 p-3 text-xs text-orange-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        {cloud ? 'Private to your login. Not shared with roommates or the admin, and separate from room expenses.'
          : 'Saved on this device only (browser storage). Clearing browser data erases it. Sign in with your own login to keep it private in the cloud.'}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-brand to-orange-400 p-4 text-white shadow">
          <p className="text-xs font-medium uppercase tracking-wide opacity-90">Today</p>
          <p className="mt-1 text-2xl font-bold">{inr(todayTotal)}</p><p className="text-xs opacity-90">{fmtDate(today)}</p></div>
        <div className="rounded-xl bg-gradient-to-br from-green-600 to-green-500 p-4 text-white shadow">
          <p className="text-xs font-medium uppercase tracking-wide opacity-90">{fmtMonth(month)}</p>
          <p className="mt-1 text-2xl font-bold">{inr(monthTotal)}</p><p className="text-xs opacity-90">Month total</p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="card"><p className="text-xs font-medium uppercase text-gray-500">Entries</p><p className="text-lg font-bold text-green-700">{monthItems.length}</p></div>
        <div className="card"><p className="text-xs font-medium uppercase text-gray-500">Daily average</p><p className="text-lg font-bold text-green-700">{inr(monthTotal / (daysCount || 1))}</p></div>
      </div>

      <form onSubmit={submit} className="card mt-4 border-t-4 border-t-brand">
        <h2 className="mb-2 font-semibold text-brand">{editId ? 'Edit expense' : 'Add expense'}</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input className="input col-span-2" placeholder="What did you spend on?" value={desc} onChange={e => setDesc(e.target.value)} />
          <input className="input" type="number" min="0" step="any" inputMode="decimal" placeholder="Amount (INR)" value={amount} onChange={e => setAmount(e.target.value)} />
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="mt-2"><ErrorMsg text={err} /></div>
        <div className="mt-2 flex gap-2"><Btn disabled={busy}><Plus size={16} />{editId ? 'Update' : 'Add'}</Btn>
          {editId && <Btn type="button" variant="ghost" onClick={cancelEdit}>Cancel</Btn>}</div>
      </form>

      <ErrorMsg text={error} />
      <div className="card mt-4"><h2 className="mb-2 font-semibold">Daily spending - {fmtMonth(month)}</h2>
        <div className="h-44"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} width={40} />
          <Tooltip formatter={(v: number) => inr(v)} /><Bar dataKey="amount" fill="#16A34A" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div>

      <h2 className="mb-2 mt-4 font-semibold">Expenses</h2>
      {loading ? <Empty text="Loading..." /> : byDay.length === 0 ? <Empty text={`No personal expenses in ${fmtMonth(month)}.`} /> : (
        <div className="space-y-3">{byDay.map(([d, list]) => (
          <div key={d} className="card p-0">
            <div className="flex items-center justify-between rounded-t-xl bg-green-50 px-4 py-2 text-sm">
              <span className="font-medium">{d === today ? 'Today' : fmtDate(d)}</span><b className="text-green-700">{inr(sum(list.map(i => i.amount)))}</b></div>
            {list.map(i => (
              <div key={i.id} className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2 text-sm">
                <span className="min-w-0 truncate">{i.description}</span>
                <span className="flex shrink-0 items-center gap-3"><b className="text-brand">{inr(i.amount)}</b>
                  <button aria-label="Edit" onClick={() => startEdit(i)}><Pencil size={16} className="text-royal" /></button>
                  <button aria-label="Delete" onClick={() => del(i)}><Trash2 size={16} className="text-red-600" /></button></span>
              </div>))}
          </div>))}</div>)}

      <div className="card mt-4"><h2 className="mb-2 font-semibold">Monthly totals</h2>
        {allMonths.map(m => (
          <button key={m} onClick={() => setMonth(m)} className={`flex w-full items-center justify-between border-t border-gray-100 py-2 text-sm first:border-0 ${m === month ? 'font-bold' : ''}`}>
            <span>{fmtMonth(m)}</span><span className="text-green-700">{inr(sum(items.filter(i => i.spent_on.startsWith(m)).map(i => i.amount)))}</span></button>))}
      </div>
    </div>)
}
