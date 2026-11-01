import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileText, Download } from 'lucide-react'
import { useData } from '../lib/data'
import { budgetStats, periodStats, sum } from '../lib/calc'
import { buildPdf, contributionRows, downloadCsv, expenseRows } from '../lib/export'
import { currentMonth, fmtMonth, inr, monthEnd, monthStart, prevMonth } from '../lib/format'
import { Btn, Field, PageHead, Stat } from '../components/ui'
import { COLORS } from './Dashboard'

export default function Reports() {
  const ctx = useData()
  const { expenses, contributions, members, categories, budgets, room } = ctx
  const [from, setFrom] = useState(monthStart(currentMonth())); const [to, setTo] = useState(monthEnd(currentMonth()))

  const st = periodStats(expenses, contributions, from, to)
  const exp = expenses.filter(e => e.expense_date >= from && e.expense_date <= to)
  const con = contributions.filter(c => c.paid_on >= from && c.paid_on <= to)
  const days = [...new Set(exp.map(e => e.expense_date))].sort().map(d => ({ day: d.slice(5), amount: sum(exp.filter(e => e.expense_date === d).map(e => e.total)) }))
  const cats = categories.map(c => ({ name: c.name, value: sum(exp.filter(e => e.category_id === c.id).map(e => e.total)) })).filter(c => c.value > 0)
  const memberData = members.map(m => ({ name: m.name, paid: sum(con.filter(c => c.member_id === m.id).map(c => c.amount)) }))
  let m = currentMonth(); const months: string[] = []
  for (let i = 0; i < 6; i++) { months.unshift(m); m = prevMonth(m) }
  const trend = months.map(mm => { const s = periodStats(expenses, contributions, monthStart(mm), monthEnd(mm)); return { month: fmtMonth(mm), Contributions: s.contributions, Expenses: s.expenses } })
  const endMonth = to.slice(0, 7)
  const budget = budgets.find(b => b.month === monthStart(endMonth))?.amount ?? 0
  const bs = budgetStats(budget, periodStats(expenses, contributions, monthStart(endMonth), monthEnd(endMonth)).expenses)

  const c = { expenses, contributions, members, categories }
  const preset = (mm: string) => { setFrom(monthStart(mm)); setTo(monthEnd(mm)) }
  const valid = from && to && from <= to
  return (
    <div>
      <PageHead title="Reports" />
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-2"><Field label="From"><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></Field></div>
        <div className="mt-2 flex gap-2 text-sm"><Btn variant="ghost" onClick={() => preset(currentMonth())}>This month</Btn><Btn variant="ghost" onClick={() => preset(prevMonth(currentMonth()))}>Last month</Btn></div>
        {!valid && <p className="mt-2 text-sm text-red-600">Choose a valid date range.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn disabled={!valid} onClick={() => buildPdf(c, from, to, 'full', room?.name ?? 'Room')}><FileText size={16} />Full PDF</Btn>
          <Btn variant="blue" disabled={!valid} onClick={() => buildPdf(c, from, to, 'expenses', room?.name ?? 'Room')}><FileText size={16} />Expenses PDF</Btn>
          <Btn variant="blue" disabled={!valid} onClick={() => buildPdf(c, from, to, 'contributions', room?.name ?? 'Room')}><FileText size={16} />Contributions PDF</Btn>
          <Btn variant="ghost" disabled={!valid} onClick={() => downloadCsv(`expenses_${from}_${to}.csv`, expenseRows(c, from, to))}><Download size={16} />Expenses CSV</Btn>
          <Btn variant="ghost" disabled={!valid} onClick={() => downloadCsv(`contributions_${from}_${to}.csv`, contributionRows(c, from, to))}><Download size={16} />Contributions CSV</Btn>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Opening" value={inr(st.opening)} /><Stat label="Contributions" value={inr(st.contributions)} tone="text-royal" />
        <Stat label="Expenses" value={inr(st.expenses)} tone="text-brand" /><Stat label="Closing" value={inr(st.closing)} tone={st.closing < 0 ? 'text-red-600' : 'text-green-600'} /></div>
      <div className="card mt-4"><h2 className="font-semibold">Budget utilization ({fmtMonth(endMonth)})</h2>
        <p className="text-sm text-gray-600">{budget ? `${bs.utilization.toFixed(1)}% of ${inr(budget)} used - ${inr(bs.remaining)} remaining` : 'No budget set for this month.'}</p>
        <div className="mt-2 h-2 overflow-hidden rounded bg-gray-200"><div className={`h-full ${bs.alert >= 90 ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${Math.min(bs.utilization, 100)}%` }} /></div></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-semibold">Daily spending trend</h2><div className="h-56"><ResponsiveContainer><LineChart data={days}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip formatter={(v: number) => inr(v)} /><Line dataKey="amount" stroke="#F58220" strokeWidth={2} /></LineChart></ResponsiveContainer></div></div>
        <div className="card"><h2 className="mb-2 font-semibold">Contributions vs expenses (6 months)</h2><div className="h-56"><ResponsiveContainer><BarChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip formatter={(v: number) => inr(v)} /><Legend /><Bar dataKey="Contributions" fill="#2878D0" /><Bar dataKey="Expenses" fill="#F58220" /></BarChart></ResponsiveContainer></div></div>
        <div className="card"><h2 className="mb-2 font-semibold">Category spending</h2>{cats.length === 0 ? <p className="py-16 text-center text-sm text-gray-500">No data</p> : <div className="h-56"><ResponsiveContainer><PieChart><Pie data={cats} dataKey="value" nameKey="name" outerRadius={80} label={d => d.name}>{cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => inr(v)} /></PieChart></ResponsiveContainer></div>}</div>
        <div className="card"><h2 className="mb-2 font-semibold">Member contributions</h2><div className="h-56"><ResponsiveContainer><BarChart data={memberData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip formatter={(v: number) => inr(v)} /><Bar dataKey="paid" fill="#2878D0" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      </div>
    </div>)
}
