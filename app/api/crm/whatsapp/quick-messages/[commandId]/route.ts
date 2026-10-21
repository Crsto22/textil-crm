import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../_proxy"

interface RouteContext {
  params: Promise<{ commandId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { commandId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/quick-messages/${commandId}`, "GET")
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { commandId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/quick-messages/${commandId}`, "PUT")
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { commandId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/quick-messages/${commandId}`, "DELETE")
}
