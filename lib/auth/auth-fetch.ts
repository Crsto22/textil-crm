import { getAccessToken, setAccessToken } from "./token-store"

let refreshPromise: Promise<string | null> | null = null

function dispatchSessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:session-expired"))
  }
}

function dispatchCrmAccessDenied() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:crm-access-denied"))
  }
}

function isCrmChatUrl(url: string) {
  return url.includes("/api/crm/whatsapp/conversations") || url.includes("/api/crm/whatsapp/messages/")
}

async function isGeneralCrmAccessDenied(response: Response) {
  try {
    const data = await response.clone().json()
    return typeof data.message === "string" && data.message.includes("No tienes acceso al CRM")
  } catch {
    return false
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" })

      if (res.status === 403) {
        setAccessToken(null)
        dispatchCrmAccessDenied()
        return null
      }

      if (!res.ok) {
        setAccessToken(null)
        dispatchSessionExpired()
        return null
      }

      const data = await res.json()
      setAccessToken(data.access_token)
      return data.access_token
    } catch {
      setAccessToken(null)
      dispatchSessionExpired()
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getAccessToken()
  const headers = new Headers(options.headers)

  if (!token) {
    token = await refreshAccessToken()
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  let response = await fetch(url, { ...options, headers })

  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`)
      response = await fetch(url, { ...options, headers })
    }
  }

  if (response.status === 403 && isCrmChatUrl(url) && await isGeneralCrmAccessDenied(response)) {
    setAccessToken(null)
    dispatchCrmAccessDenied()
  }

  return response
}
