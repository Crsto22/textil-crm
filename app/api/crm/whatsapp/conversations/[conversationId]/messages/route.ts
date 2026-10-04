import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

interface RouteContext {
  params: Promise<{ conversationId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { conversationId } = await context.params
  const query = request.nextUrl.searchParams.toString()
  const path = `/api/crm/whatsapp/conversations/${conversationId}/messages${query ? `?${query}` : ""}`
  return proxyWhatsappRequest(request, path, "GET")
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { conversationId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/conversations/${conversationId}/messages`, "POST")
}
