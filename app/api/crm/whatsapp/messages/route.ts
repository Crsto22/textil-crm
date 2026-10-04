import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../_proxy"

export async function DELETE(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/messages", "DELETE")
}
