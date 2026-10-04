import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../_proxy"

const ALLOWED_QUERY_KEYS = ["q", "filter", "page", "size"] as const

function buildForwardQuery(request: NextRequest) {
  const incoming = new URL(request.url).searchParams
  const outgoing = new URLSearchParams()

  ALLOWED_QUERY_KEYS.forEach((key) => {
    const value = incoming.get(key)
    if (value) {
      outgoing.set(key, value)
    }
  })

  const queryString = outgoing.toString()
  return queryString ? `?${queryString}` : ""
}

export async function GET(request: NextRequest) {
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/contacts${buildForwardQuery(request)}`, "GET")
}
