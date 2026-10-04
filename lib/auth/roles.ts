export const ADMIN_ROLE = "ADMINISTRADOR"
export const CRM_STANDARD_USER_PATHS = ["/chat", "/contacto", "/etiquetas"] as const

export function isCrmAdmin(role: string | null | undefined): boolean {
  return role?.trim().toUpperCase() === ADMIN_ROLE
}

export function hasCrmAccess(user: { rol?: string | null; accesoCrm?: boolean } | null | undefined): boolean {
  return isCrmAdmin(user?.rol) || user?.accesoCrm === true
}

export function isCrmStandardUserPath(pathname: string): boolean {
  return CRM_STANDARD_USER_PATHS.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}

export function getRoleLabel(role: string | null | undefined): string {
  const normalized = role?.trim().toUpperCase()
  if (normalized === "ADMINISTRADOR") return "Administrador"
  if (normalized === "VENTAS") return "Ventas"
  if (normalized === "ALMACEN") return "Almacen"
  if (normalized === "VENTAS_ALMACEN") return "Ventas y Almacen"
  if (normalized === "SISTEMA") return "Sistema"
  return role?.trim() || "Usuario"
}
