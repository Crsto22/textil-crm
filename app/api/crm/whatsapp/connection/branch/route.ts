import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../_proxy"

export async function PUT(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/connection/branch", "PUT")
}
