import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../_proxy"

export async function GET(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/transfer-users", "GET")
}
