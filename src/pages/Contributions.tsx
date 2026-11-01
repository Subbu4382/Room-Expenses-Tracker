import { useState } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { sum } from '../lib/calc'
import { downloadCsv, contributionRows } from '../lib/export'
import { fmtDate, inr, todayIST } from '../lib/format'
import { Btn, confirmDelete, Empty, ErrorMsg, Field, Modal, PageHead, Stat } from '../components/ui'
import { Contribution } from '../lib/types'

const METHODS = ['UPI', 'Cash', 'Bank transfer', 'Card', 'Other']

function Form({ initial, onClose }: { initial?: Contribution; onClose: () => void }) {
  const { room, members, reload } = useData()
  const [f, setF] = useState({ member_id: initial?.member_id ?? '', amount: initial ? String(initial.amount) : '', paid_on: initial?.paid_on ?? todayIST(),
    method: initial?.method ?? 'UPI', reference: initial?.reference ?? '', notes: initial?.notes ?? '' })
  const [err, setErr] = useState('')
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value })
  async function save() {
    if (!f.member_id) return setErr('Select a member')
    if (!(Number(f.amount) > 0)) return setErr('Amount must be greater than 0')
    if (!f.paid_on) return setErr('Date is required')
    const row = { room_id: room!.id, member_id: f.member_id, amount: Number(f.amount), paid_on: f.paid_on, method: f.method, reference: f.reference.trim() || null, notes: f.notes.trim() || null }
    const { error } = initial ? await supabase.from('contributions').update(row).eq('id', initial.id) : await supabase.from('contributions').insert(row)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  return (
    <Modal title={initial ? 'Edit contribution' : 'Add contribution'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Member"><select className="input" value={f.member_id} onChange={set('member_id')}><option value="">Select...</option>{members.filter(m => m.active || m.id === f.member_id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field></div>
        <Field label="Amount (INR)"><input type="number" min="0" step="any" className="input" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Date"><input type="date" className="input" value={f.paid_on} onChange={set('paid_on')} /></Field>
        <Field label="Payment method"><select className="input" value={f.method} onChange={set('method')}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference"><input className="input" value={f.reference} onChange={set('reference')} placeholder="UTR / txn id" /></Field>
        <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field></div>
      </div>
      <div className="mt-3"><ErrorMsg text={err} /></div>
      <div className="mt-3 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
    </Modal>)
}

export default function Contributions() {
  const { contributions, members, expenses, categories, reload } = useData()
  const { isAdmin } = useAuth()
  const [member, setMember] = useState(''); const [month, setMonth] = useState('')
  const [edit, setEdit] = useState<Contribution | 'new' | null>(null); const [err, setErr] = useState('')
  const list = contributions.filter(c => (!member || c.member_id === member) && (!month || c.paid_on.startsWith(month)))

  async function remove(c: Contribution) {
    if (!confirmDelete(`this ${inr(c.amount)} contribution`)) return
    const { error } = await supabase.from('contributions').delete().eq('id', c.id)
    if (error) setErr(error.message); else reload()
  }
  return (
    <div>
      <PageHead title="Contributions">
        <Btn variant="ghost" onClick={() => downloadCsv('contributions.csv', contributionRows({ contributions: list, expenses, members, categories }, '0000-01-01', '9999-12-31'))}><Download size={16} />CSV</Btn>
        {isAdmin && <Btn onClick={() => setEdit('new')}><Plus size={16} />Add</Btn>}
      </PageHead>
      <div className="card mb-3 grid grid-cols-2 gap-2">
        <select className="input" value={member} onChange={e => setMember(e.target.value)}><option value="">All members</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3"><Stat label="Total" value={inr(sum(list.map(c => c.amount)))} tone="text-royal" /><Stat label="Payments" value={String(list.length)} /></div>
      <ErrorMsg text={err} />
      {list.length === 0 ? <Empty text="No contributions found." /> : <div className="space-y-2">{list.map(c => (
        <div key={c.id} className="card flex items-start justify-between gap-2">
          <div><p className="font-medium">{members.find(m => m.id === c.member_id)?.name ?? 'Unknown'}</p>
            <p className="text-xs text-gray-500">{fmtDate(c.paid_on)} - {c.method}{c.reference ? ` - ${c.reference}` : ''}</p>
            {c.notes && <p className="text-xs italic text-gray-400">{c.notes}</p>}</div>
          <div className="text-right"><p className="font-bold text-royal">{inr(c.amount)}</p>
            {isAdmin && <div className="mt-1 flex justify-end gap-2"><button aria-label="Edit" onClick={() => setEdit(c)}><Pencil size={16} className="text-royal" /></button>
              <button aria-label="Delete" onClick={() => remove(c)}><Trash2 size={16} className="text-red-600" /></button></div>}</div>
        </div>))}</div>}
      {edit && <Form initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>)
}
