import React, { createContext, useContext, useEffect, useState } from 'react'
import { isAuthRetryableFetchError, type User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase' // <-- Обновлённый путь

interface AuthContextValue {
  user: User | null
  accessToken: string | null
  loading: boolean
  /**
   * Сессия на устройстве есть, но проверить её не дала сеть.
   *
   * Токен доступа живёт час. Открыл приложение позже и без сети (подвал,
   * гараж, где как раз передают инструмент) — auth-js не может обновить
   * токен, но сессию из хранилища НЕ стирает и сам обновит её, когда сеть
   * вернётся. До 03.10 getSession() с такой ошибкой читался как «вышел»:
   * закрытые страницы уводили на вход, хотя человек ни из чего не выходил.
   * Теперь это отдельное состояние: кто вошёл — неизвестно, и на вход не
   * ведём.
   */
  sessionUnknown: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null, accessToken: null, loading: true, sessionUnknown: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionUnknown, setSessionUnknown] = useState(false)

  useEffect(() => {
    let alive = true

    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!alive) return
        if (error && isAuthRetryableFetchError(error)) {
          setSessionUnknown(true)
        } else {
          setSessionUnknown(false)
          setUser(data.session?.user ?? null)
          setAccessToken(data.session?.access_token ?? null)
        }
      } catch (err) {
        // Не ответ, а отказ — значит, не знаем. Выходом это не считаем.
        console.error('[auth] сессия не прочиталась:', err)
        if (alive) setSessionUnknown(true)
      } finally {
        if (alive) setLoading(false)
      }
    }

    void check()

    // Сеть вернулась — спросить снова: auth-js обновит токен и ответит.
    const onOnline = () => { void check() }
    window.addEventListener('online', onOnline)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Начальное состояние решает check(): при сетевом сбое auth-js шлёт
      // INITIAL_SESSION с пустой сессией, и это не «вышел».
      if (event === 'INITIAL_SESSION') return
      setSessionUnknown(false)
      setUser(session?.user ?? null)
      setAccessToken(session?.access_token ?? null)
    })

    return () => {
      alive = false
      window.removeEventListener('online', onOnline)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, sessionUnknown }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
