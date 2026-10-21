import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../_proxy"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString()
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/quick-messages${query ? `?${query}` : ""}`, "GET")
}

export async function POST(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/quick-messages", "POST")
}
