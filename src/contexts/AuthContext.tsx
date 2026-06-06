import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (nickname: string, pin: string) => Promise<void>
  signIn: (nickname: string, pin: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function toEmail(nickname: string) {
  // ニックネームをURL安全な形式に変換してダミーメールを生成
  const safe = encodeURIComponent(nickname.trim().toLowerCase()).replace(/%/g, '_')
  return `${safe}@app.local`
}

// Supabase のパスワード最低長（6文字）を満たすため、PIN に固定サフィックスを付与する
function toPassword(pin: string) {
  return `${pin}__rt`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(nickname: string, pin: string) {
    const nick = nickname.trim()

    // ニックネームの重複チェック
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('nickname', nick)
      .maybeSingle()
    if (existing) throw new Error('このニックネームはすでに使われています')

    const { error } = await supabase.auth.signUp({
      email: toEmail(nick),
      password: toPassword(pin),
      options: {
        data: { display_name: nick },
      },
    })
    if (error) throw error
    // usersテーブルへのINSERTはDBトリガー (on_auth_user_created) が自動で行う
  }

  async function signIn(nickname: string, pin: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(nickname.trim()),
      password: toPassword(pin),
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
