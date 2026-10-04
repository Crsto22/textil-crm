import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../../../_proxy"

export async function POST(request: NextRequest, context: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/conversations/${conversationId}/ai/sale-draft/revalidate`, "POST")
}
