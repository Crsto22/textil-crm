import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/conversations/${conversationId}/client`, "PUT")
}
