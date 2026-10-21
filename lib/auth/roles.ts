export const ADMIN_ROLE = "ADMINISTRADOR"
export const CRM_STANDARD_USER_PATHS = ["/chat", "/comandos", "/ventas", "/contacto", "/etiquetas"] as const
export const WAREHOUSE_PATH = "/envios"

export function isCrmAdmin(role: string | null | undefined): boolean {
  return role?.trim().toUpperCase() === ADMIN_ROLE
}

export function hasCrmAccess(user: { rol?: string | null; accesoCrm?: boolean } | null | undefined): boolean {
  return isCrmAdmin(user?.rol) || isWarehouseUser(user?.rol) || user?.accesoCrm === true
}

export function isWarehouseUser(role: string | null | undefined): boolean {
  const normalized = role?.trim().toUpperCase()
  return normalized === "ALMACEN" || normalized === "VENTAS_ALMACEN"
}

export function canAccessCrmPath(
  user: { rol?: string | null; accesoCrm?: boolean } | null | undefined,
  pathname: string,
): boolean {
  if (isCrmAdmin(user?.rol)) return true
  if (pathname === WAREHOUSE_PATH || pathname.startsWith(`${WAREHOUSE_PATH}/`)) {
    return isWarehouseUser(user?.rol)
  }
  if (isWarehouseUser(user?.rol) && pathname === "/chat") return true
  const normalizedRole = user?.rol?.trim().toUpperCase()
  if (normalizedRole === "VENTAS" && (pathname === "/ventas" || pathname.startsWith("/ventas/"))) return true
  if (isWarehouseUser(normalizedRole) && (pathname === "/ventas" || pathname.startsWith("/ventas/"))) return true
  return user?.accesoCrm === true && isCrmStandardUserPath(pathname)
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
  if (normalized === "ALMACEN") return "Envíos"
  if (normalized === "VENTAS_ALMACEN") return "Ventas y Envíos"
  if (normalized === "SISTEMA") return "Sistema"
  return role?.trim() || "Usuario"
}
