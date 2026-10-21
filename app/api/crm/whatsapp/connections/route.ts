import { proxyWhatsappRequest } from "@/app/api/crm/whatsapp/_proxy"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/connections", "GET")
}
