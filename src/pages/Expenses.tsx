import { useMemo, useState } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { sum } from '../lib/calc'
import { downloadCsv, expenseRows } from '../lib/export'
import { fmtDate, fmtMonth, inr, todayIST } from '../lib/format'
import { Btn, confirmDelete, Empty, ErrorMsg, Field, Modal, PageHead, Stat } from '../components/ui'
import { Expense } from '../lib/types'

function ExpenseForm({ initial, onClose }: { initial?: Expense; onClose: () => void }) {
  const { room, categories, members, reload } = useData()
  const [f, setF] = useState({
    expense_date: initial?.expense_date ?? todayIST(), product: initial?.product ?? '', category_id: initial?.category_id ?? '',
    quantity: String(initial?.quantity ?? 1), unit: initial?.unit ?? 'pcs', unit_price: initial ? String(initial.unit_price) : '',
    purchased_by: initial?.purchased_by ?? '', vendor: initial?.vendor ?? '', notes: initial?.notes ?? '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value })
  const total = (Number(f.quantity) || 0) * (Number(f.unit_price) || 0)

  async function save() {
    if (!f.product.trim()) return setErr('Product is required')
    if (!f.expense_date) return setErr('Date is required')
    if (!(Number(f.quantity) > 0)) return setErr('Quantity must be greater than 0')
    if (f.unit_price === '' || Number(f.unit_price) < 0) return setErr('Enter a valid unit price')
    setBusy(true)
    const row = { room_id: room!.id, expense_date: f.expense_date, product: f.product.trim(), category_id: f.category_id || null,
      quantity: Number(f.quantity), unit: f.unit.trim() || 'pcs', unit_price: Number(f.unit_price),
      purchased_by: f.purchased_by || null, vendor: f.vendor.trim() || null, notes: f.notes.trim() || null }
    const { error } = initial ? await supabase.from('expenses').update(row).eq('id', initial.id) : await supabase.from('expenses').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  return (
    <Modal title={initial ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className="input" value={f.expense_date} onChange={set('expense_date')} /></Field>
        <Field label="Category"><select className="input" value={f.category_id} onChange={set('category_id')}><option value="">-</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <div className="col-span-2"><Field label="Product"><input className="input" value={f.product} onChange={set('product')} /></Field></div>
        <Field label="Quantity"><input type="number" step="any" min="0" className="input" value={f.quantity} onChange={set('quantity')} /></Field>
        <Field label="Unit"><input className="input" value={f.unit} onChange={set('unit')} placeholder="kg, L, pcs" /></Field>
        <Field label="Unit price (INR)"><input type="number" step="any" min="0" className="input" value={f.unit_price} onChange={set('unit_price')} /></Field>
        <Field label="Total"><input className="input" disabled value={inr(total)} /></Field>
        <Field label="Purchased by"><select className="input" value={f.purchased_by} onChange={set('purchased_by')}><option value="">-</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Vendor"><input className="input" value={f.vendor} onChange={set('vendor')} /></Field>
        <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field></div>
      </div>
      <div className="mt-3"><ErrorMsg text={err} /></div>
      <div className="mt-3 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Btn></div>
    </Modal>)
}

export default function Expenses() {
  const { expenses, categories, members, reload } = useData()
  const { isAdmin } = useAuth()
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [by, setBy] = useState('')
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [group, setGroup] = useState<'none' | 'day' | 'month'>('none')
  const [edit, setEdit] = useState<Expense | 'new' | null>(null); const [err, setErr] = useState('')

  const list = useMemo(() => expenses.filter(e =>
    (!q || `${e.product} ${e.vendor ?? ''} ${e.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || e.category_id === cat) && (!by || e.purchased_by === by) && (!from || e.expense_date >= from) && (!to || e.expense_date <= to)), [expenses, q, cat, by, from, to])
  const grouped = useMemo(() => {
    if (group === 'none') return []
    const map = new Map<string, number>()
    list.forEach(e => { const k = group === 'day' ? e.expense_date : e.expense_date.slice(0, 7); map.set(k, (map.get(k) ?? 0) + e.total) })
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [list, group])

  async function remove(e: Expense) {
    if (!confirmDelete(`"${e.product}"`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', e.id)
    if (error) setErr(error.message); else reload()
  }
  const exportCsv = () => downloadCsv('expenses.csv', expenseRows({ expenses: list, contributions: [], members, categories }, '0000-01-01', '9999-12-31'))

  return (
    <div>
      <PageHead title="Expenses">
        <Btn variant="ghost" onClick={exportCsv}><Download size={16} />CSV</Btn>
        {isAdmin && <Btn onClick={() => setEdit('new')}><Plus size={16} />Add</Btn>}
      </PageHead>
      <div className="card mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <input className="input col-span-2" placeholder="Search product, vendor, notes" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input" value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input" value={by} onChange={e => setBy(e.target.value)}><option value="">All buyers</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} aria-label="From" />
        <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} aria-label="To" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3"><Stat label="Matching total" value={inr(sum(list.map(e => e.total)))} tone="text-brand" /><Stat label="Entries" value={String(list.length)} /></div>
      <div className="mb-3 flex items-center gap-2 text-sm"><span className="text-gray-600">Totals:</span>
        {(['none', 'day', 'month'] as const).map(g => <button key={g} onClick={() => setGroup(g)} className={`rounded-full px-3 py-1 ${group === g ? 'bg-royal text-white' : 'bg-gray-200'}`}>{g === 'none' ? 'Off' : g === 'day' ? 'Daily' : 'Monthly'}</button>)}</div>
      {grouped.length > 0 && <div className="card mb-3 max-h-48 overflow-y-auto text-sm">{grouped.map(([k, v]) =>
        <div key={k} className="flex justify-between py-1"><span>{group === 'day' ? fmtDate(k) : fmtMonth(k)}</span><b>{inr(v)}</b></div>)}</div>}
      <ErrorMsg text={err} />
      {list.length === 0 ? <Empty text="No expenses match." /> : (
        <div className="space-y-2">{list.map(e => (
          <div key={e.id} className="card flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="font-medium">{e.product}</p>
              <p className="text-xs text-gray-500">{fmtDate(e.expense_date)} - {categories.find(c => c.id === e.category_id)?.name ?? 'Uncategorised'}</p>
              <p className="text-xs text-gray-500">{e.quantity} {e.unit} x {inr(e.unit_price)} - {members.find(m => m.id === e.purchased_by)?.name ?? 'n/a'}{e.vendor ? ` - ${e.vendor}` : ''}</p>
              {e.notes && <p className="text-xs italic text-gray-400">{e.notes}</p>}</div>
            <div className="text-right"><p className="font-bold text-brand">{inr(e.total)}</p>
              {isAdmin && <div className="mt-1 flex justify-end gap-2"><button aria-label="Edit" onClick={() => setEdit(e)}><Pencil size={16} className="text-royal" /></button>
                <button aria-label="Delete" onClick={() => remove(e)}><Trash2 size={16} className="text-red-600" /></button></div>}</div>
          </div>))}</div>)}
      {edit && <ExpenseForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>)
}
