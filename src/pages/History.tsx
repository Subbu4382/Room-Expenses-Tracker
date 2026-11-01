import { useState } from 'react'
import { FileText, Lock } from 'lucide-react'
import { useData } from '../lib/data'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { periodStats } from '../lib/calc'
import { buildPdf } from '../lib/export'
import { currentMonth, fmtDate, fmtMonth, inr, monthEnd, monthStart } from '../lib/format'
import { Btn, Empty, ErrorMsg, PageHead } from '../components/ui'

export default function History() {
  const ctx = useData()
  const { expenses, contributions, closings, room, reload } = ctx
  const { isAdmin } = useAuth()
  const [err, setErr] = useState('')

  const set = new Set<string>([currentMonth(), ...expenses.map(e => e.expense_date.slice(0, 7)), ...contributions.map(c => c.paid_on.slice(0, 7)), ...closings.map(c => c.month.slice(0, 7))])
  const months = [...set].sort().reverse()

  async function close(m: string) {
    if (!window.confirm(`Close ${fmtMonth(m)}? A snapshot of its balances will be saved. Opening balances always carry forward from live data.`)) return
    const s = periodStats(expenses, contributions, monthStart(m), monthEnd(m))
    const { error } = await supabase.from('monthly_closings').upsert(
      { room_id: room!.id, month: monthStart(m), opening_balance: s.opening, contributions: s.contributions, expenses: s.expenses, closing_balance: s.closing, closed_at: new Date().toISOString() },
      { onConflict: 'room_id,month' })
    if (error) setErr(error.message); else reload()
  }
  return (
    <div>
      <PageHead title="Monthly history" />
      <p className="mb-3 text-sm text-gray-600">Opening + Contributions - Expenses = Closing. Carried-forward balance is not counted as a new contribution.</p>
      <ErrorMsg text={err} />
      {months.length === 0 ? <Empty text="No history yet." /> : <div className="space-y-3">{months.map(m => {
        const s = periodStats(expenses, contributions, monthStart(m), monthEnd(m))
        const snap = closings.find(c => c.month.slice(0, 7) === m)
        const drift = snap && Math.abs(snap.closing_balance - s.closing) > 0.005
        return (
          <div key={m} className="card">
            <div className="flex items-center justify-between"><h2 className="font-semibold">{fmtMonth(m)}</h2>
              {snap ? <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-royal"><Lock size={12} />Closed {fmtDate(snap.closed_at)}</span> : <span className="text-xs text-gray-500">Open</span>}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><p className="text-xs text-gray-500">Opening</p><b>{inr(s.opening)}</b></div><div><p className="text-xs text-gray-500">Contributions</p><b className="text-royal">{inr(s.contributions)}</b></div>
              <div><p className="text-xs text-gray-500">Expenses</p><b className="text-brand">{inr(s.expenses)}</b></div><div><p className="text-xs text-gray-500">Closing</p><b>{inr(s.closing)}</b></div></div>
            {drift && <p className="mt-2 text-xs text-orange-700">Entries changed since closing (snapshot closing was {inr(snap!.closing_balance)}). Re-close to update.</p>}
            <div className="mt-3 flex gap-2">
              <Btn variant="ghost" onClick={() => buildPdf(ctx, monthStart(m), monthEnd(m), 'full', room?.name ?? 'Room')}><FileText size={16} />PDF</Btn>
              {isAdmin && <Btn variant="blue" onClick={() => close(m)}>{snap ? 'Re-close month' : 'Close month'}</Btn>}</div>
          </div>)})}</div>}
    </div>)
}
