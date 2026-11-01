import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { periodStats, sum } from './calc'
import { fmtDate } from './format'
import { Category, Contribution, Expense, Member } from './types'

// jsPDF's built-in fonts cannot draw the rupee sign, so PDFs use "Rs."
const rs = (n: number) => 'Rs. ' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function downloadFile(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
// UTF-8 BOM so Excel opens the CSV correctly
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
  downloadFile(name, '\ufeff' + rows.map(r => r.map(esc).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
}

interface Ctx { expenses: Expense[]; contributions: Contribution[]; members: Member[]; categories: Category[] }
const inRange = (d: string, from: string, to: string) => d >= from && d <= to
const nameOf = (list: { id: string; name: string }[], id: string | null) => list.find(x => x.id === id)?.name ?? '-'

export function expenseRows(c: Ctx, from: string, to: string) {
  const list = c.expenses.filter(e => inRange(e.expense_date, from, to)).sort((a, b) => a.expense_date.localeCompare(b.expense_date))
  return [['Date', 'Product', 'Category', 'Qty', 'Unit', 'Unit Price', 'Total', 'Purchased By', 'Vendor', 'Notes'],
    ...list.map(e => [fmtDate(e.expense_date), e.product, nameOf(c.categories, e.category_id), e.quantity, e.unit, e.unit_price, e.total, nameOf(c.members, e.purchased_by), e.vendor ?? '', e.notes ?? ''])]
}
export function contributionRows(c: Ctx, from: string, to: string) {
  const list = c.contributions.filter(x => inRange(x.paid_on, from, to)).sort((a, b) => a.paid_on.localeCompare(b.paid_on))
  return [['Date', 'Member', 'Amount', 'Method', 'Reference', 'Notes'],
    ...list.map(x => [fmtDate(x.paid_on), nameOf(c.members, x.member_id), x.amount, x.method, x.reference ?? '', x.notes ?? ''])]
}

export function buildPdf(c: Ctx, from: string, to: string, kind: 'full' | 'expenses' | 'contributions', roomName: string) {
  const doc = new jsPDF()
  const title = { full: 'Complete Statement', expenses: 'Expense Report', contributions: 'Contribution Report' }[kind]
  doc.setFillColor(245, 130, 32); doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255); doc.setFontSize(16); doc.text(`${roomName} - ${title}`, 14, 14)
  doc.setTextColor(40); doc.setFontSize(10)
  doc.text(`Period: ${fmtDate(from)} to ${fmtDate(to)}`, 14, 30)
  const st = periodStats(c.expenses, c.contributions, from, to)
  const head = { fillColor: [40, 120, 208] as [number, number, number] }
  const next = () => (doc as any).lastAutoTable.finalY + 8

  const summary: string[][] = kind === 'full'
    ? [['Opening balance (carried forward)', rs(st.opening)], ['Contributions', rs(st.contributions)], ['Expenses', rs(st.expenses)], ['Closing balance', rs(st.closing)]]
    : kind === 'expenses' ? [['Total expenses', rs(st.expenses)]] : [['Total contributions', rs(st.contributions)]]
  autoTable(doc, { startY: 34, head: [['Financial Summary', 'Amount']], body: summary, headStyles: head })

  if (kind !== 'expenses') {
    const paid = (id: string) => sum(c.contributions.filter(x => x.member_id === id && inRange(x.paid_on, from, to)).map(x => x.amount))
    autoTable(doc, { startY: next(), head: [['Member', 'Phone', 'Monthly Target', 'Paid in Period']],
      body: c.members.map(m => [m.name, m.phone ?? '-', rs(m.monthly_target), rs(paid(m.id))]), headStyles: head })
  }
  if (kind !== 'contributions') {
    const [h, ...rows] = expenseRows(c, from, to)
    autoTable(doc, { startY: next(), head: [['Expenses (' + rows.length + ')'], h.slice(0, 7).concat('By')], body: rows.map(r => [...r.slice(0, 5), rs(Number(r[5])), rs(Number(r[6])), r[7]]), headStyles: head, styles: { fontSize: 8 } })
  }
  if (kind !== 'expenses') {
    const [h, ...rows] = contributionRows(c, from, to)
    autoTable(doc, { startY: next(), head: [['Contributions (' + rows.length + ')'], h], body: rows.map(r => [r[0], r[1], rs(Number(r[2])), r[3], r[4], r[5]]), headStyles: head, styles: { fontSize: 8 } })
  }
  doc.save(`${kind}_${from}_to_${to}.pdf`)
}
