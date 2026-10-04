import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../../_proxy"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string; productId: string }> },
) {
  const { conversationId, productId } = await params
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/conversations/${conversationId}/sale-products/${productId}`,
    "GET",
  )
}
