import { NextRequest, NextResponse } from "next/server"
import { clearRefreshTokenCookie, clearSessionUserCookie, forwardCookies } from "../_helpers"

const BACKEND_URL = process.env.BACKEND_URL

function clearSessionCookies(response: NextResponse) {
  clearRefreshTokenCookie(response)
  clearSessionUserCookie(response)
}

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie")

    if (BACKEND_URL && cookieHeader) {
      try {
        const backendRes = await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Cookie: cookieHeader },
        })
        const response = NextResponse.json({ ok: true }, { status: 200 })
        forwardCookies(backendRes, response)
        clearSessionCookies(response)
        return response
      } catch {
        // limpiar localmente
      }
    }

    const response = NextResponse.json({ ok: true }, { status: 200 })
    clearSessionCookies(response)
    return response
  } catch (error) {
    console.error("[CRM_LOGOUT]", error)
    const response = NextResponse.json({ ok: true }, { status: 200 })
    clearSessionCookies(response)
    return response
  }
}
