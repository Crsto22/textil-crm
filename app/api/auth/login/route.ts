import { NextRequest, NextResponse } from "next/server"
import { hasCrmAccess } from "@/lib/auth/roles"
import type { BackendLoginResponse } from "@/lib/auth/types"
import {
  forwardCookies,
  normalizeBackendUser,
  safeParseJson,
  setSessionUserCookie,
} from "../_helpers"

const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ message: "Email y contrasena son requeridos" }, { status: 400 })
    }

    if (!BACKEND_URL) {
      return NextResponse.json({ message: "BACKEND_URL no configurado" }, { status: 500 })
    }

    let backendRes: Response
    try {
      backendRes = await fetch(`${BACKEND_URL}/api/auth/autenticarse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      return NextResponse.json(
        { message: "No se pudo conectar al servidor. Verifique que el backend este activo." },
        { status: 503 },
      )
    }

    if (!backendRes.ok) {
      const { message } = await safeParseJson(backendRes, "Error al autenticar")
      return NextResponse.json({ message }, { status: backendRes.status })
    }

    const data = (await backendRes.json()) as BackendLoginResponse
    const user = normalizeBackendUser(data as unknown as Record<string, unknown>)

    if (!hasCrmAccess(user)) {
      return NextResponse.json({ message: "No tienes acceso al CRM" }, { status: 403 })
    }

    const response = NextResponse.json({ access_token: data.access_token, user }, { status: 200 })
    forwardCookies(backendRes, response)
    setSessionUserCookie(response, user)
    return response
  } catch (error) {
    console.error("[CRM_LOGIN]", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
