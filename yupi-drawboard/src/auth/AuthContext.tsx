import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type User = {
  name: string
}

type AuthContextValue = {
  user: User | null
  login: (name: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const STORAGE_KEY = 'yupi-drawboard:user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as User
      if (parsed && typeof parsed.name === 'string') {
        setUser(parsed)
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  async function login(name: string, password: string) {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('请输入昵称')
    }

    if (!password) {
      throw new Error('请输入密码（演示用，可随意）')
    }

    await new Promise((resolve) => setTimeout(resolve, 400))

    const u: User = { name: trimmed }
    setUser(u)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    } catch {
      // ignore storage errors
    }
  }

  function logout() {
    setUser(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

