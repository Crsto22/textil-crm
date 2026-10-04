import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

interface RouteContext {
  params: Promise<{ messageId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { messageId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/messages/${messageId}/media`, "GET")
}
