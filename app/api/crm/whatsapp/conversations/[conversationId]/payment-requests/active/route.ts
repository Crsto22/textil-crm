import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../../_proxy"

export async function GET(request: NextRequest, context: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/conversations/${conversationId}/payment-requests/active`, "GET")
}
