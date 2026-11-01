import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { useData } from '../lib/data'
import { budgetStats, periodStats, sum } from '../lib/calc'
import { currentMonth, fmtDate, inr, monthEnd, monthStart } from '../lib/format'
import { PageHead, Stat } from '../components/ui'

export const COLORS = ['#F58220', '#2878D0', '#F9A95C', '#6AA3E0', '#C2610C', '#1B5CA3', '#FFC999', '#9CC1EB']

export default function Dashboard() {
  const { expenses, contributions, budgets, categories, members } = useData()
  const [month, setMonth] = useState(currentMonth())
  const from = monthStart(month), to = monthEnd(month)

  const m = periodStats(expenses, contributions, from, to)
  const all = periodStats(expenses, contributions, '0000-01-01', '9999-12-31')
  const budget = budgets.find(b => b.month === from)?.amount ?? 0
  const b = budgetStats(budget, m.expenses)

  const monthExp = expenses.filter(e => e.expense_date >= from && e.expense_date <= to)
  const daily = Array.from({ length: Number(to.slice(8)) }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`
    return { day: String(i + 1), amount: sum(monthExp.filter(e => e.expense_date === d).map(e => e.total)) }
  })
  const byCat = categories.map(c => ({ name: c.name, value: sum(monthExp.filter(e => e.category_id === c.id).map(e => e.total)) })).filter(x => x.value > 0)
  const recent = [
    ...expenses.map(e => ({ id: e.id, date: e.expense_date, label: e.product, amount: -e.total, sub: 'Expense' })),
    ...contributions.map(c => ({ id: c.id, date: c.paid_on, label: members.find(x => x.id === c.member_id)?.name ?? 'Member', amount: c.amount, sub: 'Contribution' })),
  ].sort((a, z) => z.date.localeCompare(a.date)).slice(0, 8)

  const alertText = { 100: 'Budget exceeded (100%+)', 90: 'Budget 90% used', 75: 'Budget 75% used', 0: '' }[b.alert]
  return (
    <div>
      <PageHead title="Dashboard"><input type="month" className="input w-auto" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></PageHead>
      {b.alert > 0 && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${b.alert === 100 ? 'bg-red-100 text-red-800' : b.alert === 90 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
          <AlertTriangle size={18} /> {alertText} - {inr(m.expenses)} of {inr(budget)}</div>)}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Expenses (month)" value={inr(m.expenses)} tone="text-brand" />
        <Stat label="Contributions (month)" value={inr(m.contributions)} tone="text-royal" />
        <Stat label="Available balance" value={inr(all.closing)} tone={all.closing < 0 ? 'text-red-600' : 'text-green-600'} sub="All-time contributions - expenses" />
        <Stat label="Monthly budget" value={budget ? inr(budget) : 'Not set'} />
        <Stat label="Remaining budget" value={inr(b.remaining)} tone={b.remaining < 0 ? 'text-red-600' : ''} sub="Budget - month expenses" />
        <Stat label="Utilization" value={`${b.utilization.toFixed(1)}%`} />
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-gray-200"><div className={`h-full ${b.alert >= 90 ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${Math.min(b.utilization, 100)}%` }} /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-semibold">Daily spending</h2>
          <div className="h-56"><ResponsiveContainer><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} width={40} />
            <Tooltip formatter={(v: number) => inr(v)} /><Bar dataKey="amount" fill="#F58220" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="card"><h2 className="mb-2 font-semibold">By category</h2>
          {byCat.length === 0 ? <p className="py-16 text-center text-sm text-gray-500">No expenses this month</p> :
            <div className="h-56"><ResponsiveContainer><PieChart><Pie data={byCat} dataKey="value" nameKey="name" outerRadius={80} label={d => d.name}>
              {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => inr(v)} /></PieChart></ResponsiveContainer></div>}</div>
      </div>
      <div className="card mt-4"><h2 className="mb-2 font-semibold">Recent transactions</h2>
        {recent.length === 0 ? <p className="text-sm text-gray-500">Nothing yet.</p> : recent.map(r => (
          <div key={r.id} className="flex items-center justify-between border-t border-gray-100 py-2 text-sm first:border-0">
            <div><p className="font-medium">{r.label}</p><p className="text-xs text-gray-500">{r.sub} - {fmtDate(r.date)}</p></div>
            <span className={r.amount < 0 ? 'text-brand' : 'text-green-600'}>{r.amount < 0 ? '-' : '+'}{inr(Math.abs(r.amount))}</span></div>))}
      </div>
    </div>)
}
