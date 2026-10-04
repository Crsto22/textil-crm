const BACKEND_BASE =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "")
    : ""

function stripStoragePrefix(pathname: string) {
  return pathname.replace(/^\/storage(?=\/|$)/, "")
}

/**
 * Converts a relative backend path (e.g. /storage/productos/...)
 * to an absolute URL using NEXT_PUBLIC_BACKEND_URL.
 * Backend storage URLs are rewritten to the public storage host.
 */
export function resolveBackendUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^(blob:|data:)/.test(url)) return url

  if (/^https?:/.test(url)) {
    try {
      const parsed = new URL(url)
      const publicBase = BACKEND_BASE ? new URL(BACKEND_BASE) : null
      const isBackendStorageUrl =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "api.kiments.tech"
      const isPublicStorageUrl =
        publicBase !== null &&
        parsed.protocol === publicBase.protocol &&
        parsed.host === publicBase.host

      if (!BACKEND_BASE) return url
      if (isPublicStorageUrl) {
        return `${BACKEND_BASE}${stripStoragePrefix(parsed.pathname)}${parsed.search}`
      }
      if (!isBackendStorageUrl) return url
      return `${BACKEND_BASE}${stripStoragePrefix(parsed.pathname)}${parsed.search}`
    } catch {
      return url
    }
  }

  if (!BACKEND_BASE) return url
  const path = stripStoragePrefix(url.startsWith("/") ? url : `/${url}`)
  return `${BACKEND_BASE}${path}`
}
