import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../../../../_proxy"

interface RouteContext {
  params: Promise<{ conversationId: string; runId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { conversationId, runId } = await context.params
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/conversations/${conversationId}/ai/runs/${runId}/decision`,
    "POST",
  )
}
