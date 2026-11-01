import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { sum } from '../lib/calc'
import { currentMonth, inr } from '../lib/format'
import { Btn, confirmDelete, Empty, ErrorMsg, Field, Modal, PageHead } from '../components/ui'
import { Member } from '../lib/types'

function MemberForm({ initial, onClose }: { initial?: Member; onClose: () => void }) {
  const { room, reload } = useData()
  const [f, setF] = useState({ name: initial?.name ?? '', phone: initial?.phone ?? '', target: String(initial?.monthly_target ?? ''), active: initial?.active ?? true })
  const [err, setErr] = useState('')
  async function save() {
    if (!f.name.trim()) return setErr('Name is required')
    if (f.target !== '' && Number(f.target) < 0) return setErr('Target cannot be negative')
    const row = { room_id: room!.id, name: f.name.trim(), phone: f.phone.trim() || null, monthly_target: Number(f.target) || 0, active: f.active }
    const { error } = initial ? await supabase.from('room_members').update(row).eq('id', initial.id) : await supabase.from('room_members').insert(row)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }
  return (
    <Modal title={initial ? 'Edit member' : 'Add member'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name"><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Monthly contribution target (INR)"><input type="number" min="0" className="input" value={f.target} onChange={e => setF({ ...f, target: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />Active member</label>
        <ErrorMsg text={err} />
        <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
      </div>
    </Modal>)
}

export default function Members() {
  const { members, contributions, reload } = useData()
  const { isAdmin } = useAuth()
  const [edit, setEdit] = useState<Member | 'new' | null>(null); const [err, setErr] = useState('')
  const month = currentMonth()

  async function remove(m: Member) {
    if (!confirmDelete(`member "${m.name}"`)) return
    const { error } = await supabase.from('room_members').delete().eq('id', m.id)
    if (error) setErr(error.code === '23503' ? `${m.name} has contributions on record and can't be deleted. Mark them inactive instead.` : error.message)
    else reload()
  }
  return (
    <div>
      <PageHead title="Members">{isAdmin && <Btn onClick={() => setEdit('new')}><Plus size={16} />Add member</Btn>}</PageHead>
      <ErrorMsg text={err} />
      {members.length === 0 ? <Empty text="No members yet." /> : (
        <div className="grid gap-3 sm:grid-cols-2">{members.map(m => {
          const paid = sum(contributions.filter(c => c.member_id === m.id && c.paid_on.startsWith(month)).map(c => c.amount))
          const pct = m.monthly_target > 0 ? Math.min((paid / m.monthly_target) * 100, 100) : 0
          return (
            <div key={m.id} className={`card ${m.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between"><div><p className="font-semibold">{m.name}{!m.active && ' (inactive)'}</p><p className="text-xs text-gray-500">{m.phone ?? 'No phone'}</p></div>
                {isAdmin && <div className="flex gap-2"><button aria-label="Edit" onClick={() => setEdit(m)}><Pencil size={16} className="text-royal" /></button>
                  <button aria-label="Delete" onClick={() => remove(m)}><Trash2 size={16} className="text-red-600" /></button></div>}</div>
              <p className="mt-2 text-sm">This month: <b>{inr(paid)}</b> of {inr(m.monthly_target)}</p>
              <div className="mt-1 h-2 overflow-hidden rounded bg-gray-200"><div className="h-full bg-royal" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-xs text-gray-500">{paid >= m.monthly_target && m.monthly_target > 0 ? 'Target met' : `Pending ${inr(Math.max(m.monthly_target - paid, 0))}`}</p>
            </div>)})}</div>)}
      {edit && <MemberForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>)
}
