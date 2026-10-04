import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../_proxy"

export async function POST(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/connection/ai-control", "POST")
}
