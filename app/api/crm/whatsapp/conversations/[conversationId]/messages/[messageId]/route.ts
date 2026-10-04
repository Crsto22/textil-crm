import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../../_proxy"

interface RouteContext {
  params: Promise<{ conversationId: string; messageId: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { conversationId, messageId } = await context.params
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/conversations/${conversationId}/messages/${messageId}`,
    "DELETE",
  )
}
