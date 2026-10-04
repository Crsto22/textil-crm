import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params
  const search = request.nextUrl.searchParams.toString()
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/conversations/${conversationId}/sale-options${search ? `?${search}` : ""}`,
    "GET",
  )
}
