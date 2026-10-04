import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../../_proxy"

export async function POST(request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/messages/${messageId}/payment-evidence/analyze`, "POST")
}
