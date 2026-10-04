import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

interface RouteContext {
  params: Promise<{ conversationId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { conversationId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/conversations/${conversationId}/accept`, "POST")
}
