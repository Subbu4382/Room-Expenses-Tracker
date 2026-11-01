import { Contribution, Expense } from './types'
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const r2 = (n: number) => Math.round(n * 100) / 100

// All figures derive from database rows - nothing is hardcoded.
export function periodStats(exp: Expense[], con: Contribution[], from: string, to: string) {
  const opening = sum(con.filter(c => c.paid_on < from).map(c => c.amount)) - sum(exp.filter(e => e.expense_date < from).map(e => e.total))
  const contributions = sum(con.filter(c => c.paid_on >= from && c.paid_on <= to).map(c => c.amount))
  const expenses = sum(exp.filter(e => e.expense_date >= from && e.expense_date <= to).map(e => e.total))
  // Opening balance is carried forward - it is NOT counted as a contribution.
  return { opening: r2(opening), contributions: r2(contributions), expenses: r2(expenses), closing: r2(opening + contributions - expenses) }
}
export function budgetStats(budget: number, spent: number) {
  const utilization = budget > 0 ? (spent / budget) * 100 : 0
  return { remaining: r2(budget - spent), utilization, // remaining budget is separate from available balance
    alert: utilization >= 100 ? 100 : utilization >= 90 ? 90 : utilization >= 75 ? 75 : 0 }
}
