import { NextRequest, NextResponse } from "next/server"

import { forwardCookies } from "../../../auth/_helpers"

const BACKEND_URL = process.env.BACKEND_URL

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
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

    const backendRes = await fetch(`${BACKEND_URL}/api/crm/whatsapp/events`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: authHeader,
        Accept: "text/event-stream",
      },
      signal: request.signal,
    })

    if (!backendRes.ok || !backendRes.body) {
      const body = await backendRes.arrayBuffer()
      return new NextResponse(body, {
        status: backendRes.status,
        headers: { "Content-Type": backendRes.headers.get("content-type") || "application/json" },
      })
    }

    const response = new NextResponse(backendRes.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
    if (refreshRes) forwardCookies(refreshRes, response)
    return response
  } catch {
    return NextResponse.json({ message: "No se pudo conectar al canal en tiempo real" }, { status: 503 })
  }
}
