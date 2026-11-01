import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { fetchAll, supabase } from './supabase'
import { Budget, Category, Closing, Contribution, Expense, Member, Room } from './types'

interface DataState {
  room: Room | null; members: Member[]; categories: Category[]; expenses: Expense[]
  contributions: Contribution[]; budgets: Budget[]; closings: Closing[]
  loading: boolean; error: string; reload: () => Promise<void>
}
const Ctx = createContext<DataState>(null!)
export const useData = () => useContext(Ctx)

export function DataProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Omit<DataState, 'reload'>>({ room: null, members: [], categories: [], expenses: [], contributions: [], budgets: [], closings: [], loading: true, error: '' })

  const reload = useCallback(async () => {
    try {
      const { data: room, error } = await supabase.from('rooms').select('*').order('created_at').limit(1).maybeSingle()
      if (error) throw error
      if (!room) throw new Error('No room found. Run the seed section of supabase/schema.sql.')
      const [members, categories, expenses, contributions, budgets, closings] = await Promise.all([
        fetchAll<Member>('room_members', 'created_at'), fetchAll<Category>('categories', 'created_at'),
        fetchAll<Expense>('expenses', 'expense_date'), fetchAll<Contribution>('contributions', 'paid_on'),
        fetchAll<Budget>('monthly_budgets', 'month'), fetchAll<Closing>('monthly_closings', 'month')])
      setS({ room, members: members.reverse(), categories: categories.reverse(), expenses, contributions, budgets, closings, loading: false, error: '' })
    } catch (e: any) { setS(p => ({ ...p, loading: false, error: e.message ?? String(e) })) }
  }, [])

  useEffect(() => { reload() }, [reload])
  return <Ctx.Provider value={{ ...s, reload }}>{children}</Ctx.Provider>
}
