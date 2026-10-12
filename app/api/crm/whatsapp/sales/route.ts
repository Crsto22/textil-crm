import { NextRequest } from "next/server"

import { proxyWhatsappRequest } from "@/app/api/crm/whatsapp/_proxy"

export async function GET(request: NextRequest) {
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/sales${request.nextUrl.search}`, "GET")
}
