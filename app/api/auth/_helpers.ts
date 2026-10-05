import { NextResponse } from "next/server"
import type { AuthUser } from "@/lib/auth/types"

interface CookieOptions {
  path?: string
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "lax" | "strict" | "none"
  domain?: string
}

export function forwardCookies(backendRes: Response, nextRes: NextResponse): void {
  const setCookieHeaders = backendRes.headers.getSetCookie()

  for (const raw of setCookieHeaders) {
    const parsed = parseSetCookie(raw)
    if (parsed) {
      const migrateRefreshCookie = parsed.name === "refresh_token" && process.env.COOKIE_DOMAIN
      if (migrateRefreshCookie) {
        parsed.options.domain = process.env.COOKIE_DOMAIN
      }
      nextRes.cookies.set(parsed.name, parsed.value, parsed.options)
      if (migrateRefreshCookie) {
        appendHostRefreshTokenDeletion(nextRes, parsed.options.path)
      }
    }
  }
}

export function setSessionUserCookie(nextRes: NextResponse, user: AuthUser): void {
  nextRes.cookies.set("session_user", JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearRefreshTokenCookie(nextRes: NextResponse): void {
  nextRes.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 0,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  })
  if (process.env.COOKIE_DOMAIN) {
    appendHostRefreshTokenDeletion(nextRes)
  }
}

export function clearSessionUserCookie(nextRes: NextResponse): void {
  nextRes.cookies.set("session_user", "", { path: "/", maxAge: 0 })
}

function appendHostRefreshTokenDeletion(nextRes: NextResponse, path = "/api/auth"): void {
  const attributes = ["refresh_token=", `Path=${path}`, "Max-Age=0", "HttpOnly", "SameSite=Lax"]
  if (process.env.NODE_ENV === "production") attributes.push("Secure")
  nextRes.headers.append("Set-Cookie", attributes.join("; "))
}

export function normalizeBackendUser(data: Record<string, unknown>): AuthUser {
  return {
    idUsuario: Number(data.idUsuario),
    nombre: String(data.nombre ?? ""),
    apellido: String(data.apellido ?? ""),
    correo: String(data.correo ?? ""),
    dni: typeof data.dni === "string" ? data.dni : null,
    telefono: typeof data.telefono === "string" ? data.telefono : null,
    fotoPerfilUrl: typeof data.fotoPerfilUrl === "string" ? data.fotoPerfilUrl : null,
    rol: String(data.rol ?? ""),
    estado: typeof data.estado === "string" ? data.estado : "ACTIVO",
    fechaCreacion: typeof data.fechaCreacion === "string" ? data.fechaCreacion : null,
    idSucursal: typeof data.idSucursal === "number" ? data.idSucursal : null,
    nombreSucursal: typeof data.nombreSucursal === "string" ? data.nombreSucursal : null,
    tipoSucursal: typeof data.tipoSucursal === "string" ? data.tipoSucursal : null,
    sucursalesPermitidas: Array.isArray(data.sucursalesPermitidas) ? data.sucursalesPermitidas : [],
    idTurno: typeof data.idTurno === "number" ? data.idTurno : null,
    nombreTurno: typeof data.nombreTurno === "string" ? data.nombreTurno : null,
    horaInicioTurno: typeof data.horaInicioTurno === "string" ? data.horaInicioTurno : null,
    horaFinTurno: typeof data.horaFinTurno === "string" ? data.horaFinTurno : null,
    diasTurno: Array.isArray(data.diasTurno) ? data.diasTurno.filter((item): item is string => typeof item === "string") : null,
    horariosTurno: Array.isArray(data.horariosTurno) ? data.horariosTurno : null,
    puedeAceptarPedidos: data.puedeAceptarPedidos === true,
    accesoCrm: data.accesoCrm === true,
  }
}

function parseSetCookie(raw: string): { name: string; value: string; options: CookieOptions } | null {
  const parts = raw.split(";").map((part) => part.trim())
  const [nameValue, ...attrs] = parts
  if (!nameValue) return null

  const eqIdx = nameValue.indexOf("=")
  if (eqIdx === -1) return null

  const options: CookieOptions = {}

  for (const attr of attrs) {
    const lower = attr.toLowerCase()
    if (lower === "httponly") {
      options.httpOnly = true
    } else if (lower === "secure") {
      options.secure = true
    } else if (lower.startsWith("path=")) {
      options.path = attr.substring(5)
    } else if (lower.startsWith("max-age=")) {
      options.maxAge = parseInt(attr.substring(8), 10)
    } else if (lower.startsWith("samesite=")) {
      options.sameSite = attr.substring(9).toLowerCase() as CookieOptions["sameSite"]
    } else if (lower.startsWith("domain=")) {
      options.domain = attr.substring(7)
    }
  }

  return {
    name: nameValue.substring(0, eqIdx),
    value: nameValue.substring(eqIdx + 1),
    options,
  }
}

export async function safeParseJson(res: Response, fallbackMessage: string): Promise<{ message: string }> {
  const text = await res.text()

  try {
    const json = JSON.parse(text)
    return { message: json.message || fallbackMessage }
  } catch {
    return { message: text || fallbackMessage }
  }
}
