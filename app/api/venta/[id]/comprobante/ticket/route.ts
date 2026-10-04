import { NextRequest, NextResponse } from "next/server"
import { forwardCookies } from "../../../../auth/_helpers"

const BACKEND_URL = process.env.BACKEND_URL

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!BACKEND_URL) {
    return NextResponse.json({ message: "BACKEND_URL no configurado" }, { status: 500 })
  }

  const { id } = await params
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

  const backendRes = await fetch(`${BACKEND_URL}/api/venta/${id}/comprobante/ticket`, {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: authHeader },
  })
  const responseBody = await backendRes.arrayBuffer()
  const response = new NextResponse(responseBody, {
    status: backendRes.status,
    headers: {
      "Content-Type": backendRes.headers.get("content-type") || "application/pdf",
      ...(backendRes.headers.get("content-disposition")
        ? { "Content-Disposition": backendRes.headers.get("content-disposition") as string }
        : {}),
    },
  })

  if (refreshRes) {
    forwardCookies(refreshRes, response)
  }

  return response
}
