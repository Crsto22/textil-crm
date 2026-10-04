const WHATSAPP_SUFFIX = "@s.whatsapp.net"
const LEGACY_WHATSAPP_SUFFIX = "@c.us"

export function sanitizePeruvianMobileInput(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(0, 11)
}

export function normalizePeruvianMobile(value: string | null | undefined) {
  let candidate = (value ?? "").trim().toLowerCase()
  if (!candidate || candidate.includes("@lid")) return ""

  if (candidate.includes("@")) {
    if (candidate.endsWith(WHATSAPP_SUFFIX)) {
      candidate = candidate.slice(0, -WHATSAPP_SUFFIX.length)
    } else if (candidate.endsWith(LEGACY_WHATSAPP_SUFFIX)) {
      candidate = candidate.slice(0, -LEGACY_WHATSAPP_SUFFIX.length)
    } else {
      return ""
    }
  }

  let digits = candidate.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("51")) {
    digits = digits.slice(2)
  }
  return /^9\d{8}$/.test(digits) ? digits : ""
}

export function isValidPeruvianMobile(value: string | null | undefined) {
  return normalizePeruvianMobile(value) !== ""
}
