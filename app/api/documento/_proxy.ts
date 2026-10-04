import { NextRequest, NextResponse } from "next/server"
import { forwardCookies } from "../auth/_helpers"

const BACKEND_URL = process.env.BACKEND_URL

export async function proxyDocumentoRequest(request: NextRequest, path: string) {
  if (!BACKEND_URL) {
    return NextResponse.json({ message: "BACKEND_URL no configurado" }, { status: 500 })
  }

  try {
    let authHeader = request.headers.get("authorization")
    let refreshRes: Response | null = null

    if (!authHeader) {
      const cookieHeader = request.headers.get("cookie")
      if (!cookieHeader?.includes("refresh_token")) {
        return NextResponse.json({ message: "No autenticado" }, { status: 401 })
      }

      refreshRes = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { Cookie: cookieHeader },
      })

      if (!refreshRes.ok) {
        return NextResponse.json({ message: "Sesion expirada" }, { status: 401 })
      }

      const refreshed = await refreshRes.json()
      authHeader = `Bearer ${refreshed.access_token}`
    }

    const backendRes = await fetch(`${BACKEND_URL}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: authHeader },
    })
    const responseBody = await backendRes.arrayBuffer()
    const response = new NextResponse(responseBody.byteLength ? responseBody : "{}", {
      status: backendRes.status,
      headers: { "Content-Type": backendRes.headers.get("content-type") || "application/json" },
    })

    if (refreshRes) {
      forwardCookies(refreshRes, response)
    }

    return response
  } catch {
    return NextResponse.json({ message: "No se pudo consultar el documento" }, { status: 503 })
  }
}
