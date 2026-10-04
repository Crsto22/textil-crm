"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { clearAccessToken, setAccessToken } from "@/lib/auth/token-store"
import { hasCrmAccess } from "@/lib/auth/roles"
import type { AuthResponse, AuthUser, LoginRequest } from "@/lib/auth/types"

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<{ ok: boolean; message?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function forbiddenResult() {
  return { ok: false, message: "No tienes acceso al CRM" }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(async () => {
    clearAccessToken()
    setUser(null)
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {
      // limpiar estado local aunque falle el backend
    }
  }, [])

  const fetchCurrentUser = useCallback(async (accessToken: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!res.ok) return null

      return (await res.json()) as AuthUser
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" })

        if (!res.ok) {
          if (res.status === 403) {
            try {
              window.sessionStorage.setItem("auth:crm-access-denied", "1")
            } catch {
              // continuar sin aviso persistente
            }
          }
          setUser(null)
          return
        }

        const data: AuthResponse = await res.json()
        setAccessToken(data.access_token)
        const currentUser = await fetchCurrentUser(data.access_token)
        const resolvedUser = currentUser ?? data.user ?? null

        if (!hasCrmAccess(resolvedUser)) {
          clearAccessToken()
          setUser(null)
          return
        }

        setUser(resolvedUser)
      } catch {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [clearSession, fetchCurrentUser])

  useEffect(() => {
    const handleSessionExpired = async () => {
      clearAccessToken()
      setUser(null)
      try {
        window.sessionStorage.setItem("auth:session-expired", "1")
      } catch {
        // continuar con redirect
      }
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
      } catch {
        // ignorar
      }
      window.location.href = "/"
    }

    window.addEventListener("auth:session-expired", handleSessionExpired)
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired)
  }, [])

  useEffect(() => {
    const handleAccessDenied = () => {
      clearAccessToken()
      setUser(null)
      try {
        window.sessionStorage.setItem("auth:crm-access-denied", "1")
      } catch {
        // continuar con redirect
      }
      window.location.href = "/"
    }

    window.addEventListener("auth:crm-access-denied", handleAccessDenied)
    return () => window.removeEventListener("auth:crm-access-denied", handleAccessDenied)
  }, [])

  const login = useCallback(
    async (credentials: LoginRequest): Promise<{ ok: boolean; message?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        })

        const data = await res.json()

        if (!res.ok) {
          return { ok: false, message: data.message }
        }

        const { access_token, user: userData } = data as AuthResponse
        setAccessToken(access_token)
        const currentUser = await fetchCurrentUser(access_token)
        const resolvedUser = currentUser ?? userData ?? null

        if (!hasCrmAccess(resolvedUser)) {
          clearAccessToken()
          setUser(null)
          return forbiddenResult()
        }

        setUser(resolvedUser)
        return { ok: true }
      } catch {
        return { ok: false, message: "Error de conexion. Intente nuevamente." }
      }
    },
    [fetchCurrentUser],
  )

  const logout = useCallback(async () => {
    await clearSession()
  }, [clearSession])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>")
  }
  return context
}
