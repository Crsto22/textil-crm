import { NextRequest, NextResponse } from "next/server"
import { hasCrmAccess } from "@/lib/auth/roles"
import { clearSessionUserCookie, forwardCookies, normalizeBackendUser, safeParseJson, setSessionUserCookie } from "../_helpers"

const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie")

    if (!cookieHeader?.includes("refresh_token")) {
      return NextResponse.json({ message: "No hay sesion activa" }, { status: 401 })
    }

    if (!BACKEND_URL) {
      return NextResponse.json({ message: "BACKEND_URL no configurado" }, { status: 500 })
    }

    let backendRes: Response
    try {
      backendRes = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { Cookie: cookieHeader },
      })
    } catch {
      return NextResponse.json({ message: "No se pudo conectar al servidor." }, { status: 503 })
    }

    if (!backendRes.ok) {
      const { message } = await safeParseJson(backendRes, "Sesion expirada")
      const response = NextResponse.json({ message }, { status: 401 })
      forwardCookies(backendRes, response)
      clearSessionUserCookie(response)
      return response
    }

    const data = await backendRes.json()
    let meRes: Response
    try {
      meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        method: "GET",
        cache: "no-store",
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
    } catch {
      return NextResponse.json({ message: "No se pudo conectar al servidor." }, { status: 503 })
    }

    if (!meRes.ok) {
      const { message } = await safeParseJson(meRes, "Error al obtener usuario autenticado")
      const response = NextResponse.json({ message }, { status: meRes.status >= 400 ? meRes.status : 400 })
      forwardCookies(backendRes, response)
      return response
    }

    const user = normalizeBackendUser(await meRes.json())

    if (!hasCrmAccess(user)) {
      const response = NextResponse.json({ message: "No tienes acceso al CRM" }, { status: 403 })
      forwardCookies(backendRes, response)
      return response
    }

    const response = NextResponse.json({ access_token: data.access_token, user }, { status: 200 })
    forwardCookies(backendRes, response)
    setSessionUserCookie(response, user)
    return response
  } catch (error) {
    console.error("[CRM_REFRESH]", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
