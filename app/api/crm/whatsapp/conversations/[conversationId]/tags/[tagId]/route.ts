import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../../_proxy"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string; tagId: string }> },
) {
  const { conversationId, tagId } = await params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/conversations/${conversationId}/tags/${tagId}`, "POST")
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string; tagId: string }> },
) {
  const { conversationId, tagId } = await params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/conversations/${conversationId}/tags/${tagId}`, "DELETE")
}
