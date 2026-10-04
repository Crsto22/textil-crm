import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "@/app/api/crm/whatsapp/_proxy"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/connection/ai-knowledge${url.search}`, "GET")
}

export async function POST(request: NextRequest) {
  return proxyWhatsappRequest(request, "/api/crm/whatsapp/connection/ai-knowledge", "POST")
}
