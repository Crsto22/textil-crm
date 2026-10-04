import { NextRequest, NextResponse } from "next/server"
import { hasCrmAccess } from "@/lib/auth/roles"
import { normalizeBackendUser, safeParseJson, setSessionUserCookie } from "../_helpers"

const BACKEND_URL = process.env.BACKEND_URL

export async function GET(request: NextRequest) {
  try {
    if (!BACKEND_URL) {
      return NextResponse.json({ message: "BACKEND_URL no configurado" }, { status: 500 })
    }

    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 })
    }

    let backendRes: Response
    try {
      backendRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        method: "GET",
        cache: "no-store",
        headers: { Authorization: authHeader },
      })
    } catch {
      return NextResponse.json({ message: "No se pudo conectar al servidor." }, { status: 503 })
    }

    if (!backendRes.ok) {
      const { message } = await safeParseJson(backendRes, "Error al obtener usuario autenticado")
      return NextResponse.json({ message }, { status: backendRes.status >= 400 ? backendRes.status : 400 })
    }

    const user = normalizeBackendUser(await backendRes.json())
    if (!hasCrmAccess(user)) {
      return NextResponse.json({ message: "No tienes acceso al CRM" }, { status: 403 })
    }

    const response = NextResponse.json(user, { status: 200 })
    setSessionUserCookie(response, user)
    return response
  } catch (error) {
    console.error("[CRM_ME]", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
