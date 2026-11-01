import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { Profile } from './types'

interface AuthState { session: Session | null; profile: Profile | null; loading: boolean; isAdmin: boolean; signOut: () => void }
const Ctx = createContext<AuthState>(null!)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) { setProfile(null); setLoading(false) } })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { setProfile(data as Profile | null); setLoading(false) })
  }, [session?.user.id])

  return <Ctx.Provider value={{ session, profile, loading, isAdmin: profile?.role === 'admin', signOut: () => supabase.auth.signOut() }}>{children}</Ctx.Provider>
}
