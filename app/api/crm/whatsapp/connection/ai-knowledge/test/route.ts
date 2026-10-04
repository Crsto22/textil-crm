import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "@/app/api/crm/whatsapp/_proxy"

export async function POST(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/connection/ai-knowledge/test", "POST")
}
