import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../_proxy"

export async function GET(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/connection/ai-credentials", "GET")
}

export async function PUT(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/connection/ai-credentials", "PUT")
}

export async function DELETE(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/connection/ai-credentials", "DELETE")
}
