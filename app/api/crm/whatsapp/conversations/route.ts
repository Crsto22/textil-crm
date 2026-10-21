import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../_proxy"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString()
  const path = `/api/crm/whatsapp/conversations${query ? `?${query}` : ""}`
  return proxyWhatsappRequest(request, path, "GET")
}

export async function DELETE(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString()
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/conversations${query ? `?${query}` : ""}`, "DELETE")
}
