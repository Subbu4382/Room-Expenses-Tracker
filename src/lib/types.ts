export type Role = 'admin' | 'viewer'
export interface Profile { id: string; full_name: string | null; role: Role }
export interface Room { id: string; name: string }
export interface Member { id: string; room_id: string; name: string; phone: string | null; monthly_target: number; active: boolean }
export interface Category { id: string; room_id: string; name: string }
export interface Expense { id: string; room_id: string; expense_date: string; product: string; category_id: string | null; quantity: number; unit: string; unit_price: number; total: number; purchased_by: string | null; vendor: string | null; notes: string | null }
export interface Contribution { id: string; room_id: string; member_id: string; amount: number; paid_on: string; method: string; reference: string | null; notes: string | null }
export interface Budget { id: string; room_id: string; month: string; amount: number }
export interface Closing { id: string; room_id: string; month: string; opening_balance: number; contributions: number; expenses: number; closing_balance: number; closed_at: string }
