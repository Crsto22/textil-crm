import { NextRequest } from "next/server"

import { proxyWhatsappRequest } from "../../../../_proxy"

interface RouteContext {
  params: Promise<{ conversationId: string; deliveryId: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { conversationId, deliveryId } = await context.params
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/conversations/${conversationId}/pending-message/${deliveryId}`,
    "DELETE",
  )
}
