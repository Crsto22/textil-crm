import { NextRequest } from "next/server"

import { proxyWhatsappRequest } from "../../../../../_proxy"

interface RouteContext {
  params: Promise<{ conversationId: string; saleId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { conversationId, saleId } = await context.params
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/conversations/${conversationId}/sales/${saleId}/receipt`,
    "POST",
  )
}
