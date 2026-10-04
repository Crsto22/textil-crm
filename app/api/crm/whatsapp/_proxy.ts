import { NextRequest, NextResponse } from "next/server"
import { forwardCookies } from "../../auth/_helpers"

const BACKEND_URL = process.env.BACKEND_URL

export async function proxyWhatsappRequest(request: NextRequest, path: string, method: "GET" | "POST" | "PUT" | "DELETE") {
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

    const headers: Record<string, string> = { Authorization: authHeader }
    let requestBody: ArrayBuffer | undefined

    if (method !== "GET") {
      requestBody = await request.arrayBuffer()
      headers["Content-Type"] = request.headers.get("content-type") || "application/json"
    }

    const backendRes = await fetch(`${BACKEND_URL}${path}`, {
      method,
      cache: "no-store",
      headers,
      body: requestBody,
    })
    const contentType = backendRes.headers.get("content-type") || "application/json"
    const responseBody = await backendRes.arrayBuffer()

    const response = new NextResponse(
      responseBody.byteLength ? responseBody : contentType.includes("application/json") ? "{}" : null,
      {
        status: backendRes.status,
        headers: {
          "Content-Type": contentType,
        },
      },
    )

    if (refreshRes) {
      forwardCookies(refreshRes, response)
    }

    return response
  } catch {
    return NextResponse.json({ message: "No se pudo conectar al servidor." }, { status: 503 })
  }
}
