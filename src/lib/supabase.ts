import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const configured = Boolean(url && key)

// Viewer link: opening https://site/#view=TOKEN stores the token, which is sent as a header.
// The database (RLS) only allows read-only access when the token matches.
const TOKEN_KEY = 'rem_view_token'
function readViewToken(): string | null {
  const m = window.location.hash.match(/view=([A-Za-z0-9]{20,})/)
  let t: string | null = m ? m[1] : null
  try { if (m) localStorage.setItem(TOKEN_KEY, m[1]); else t = localStorage.getItem(TOKEN_KEY) } catch { /* storage blocked */ }
  if (m) history.replaceState(null, '', window.location.pathname + window.location.search)
  return t
}
export const viewToken = readViewToken()
export const clearViewToken = () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } window.location.reload() }
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing',
  viewToken ? { global: { headers: { 'x-view-token': viewToken } } } : undefined)

// Supabase returns max 1000 rows per request, so page through everything.
export async function fetchAll<T>(table: string, orderCol: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(orderCol, { ascending: false }).range(from, from + 999)
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}
