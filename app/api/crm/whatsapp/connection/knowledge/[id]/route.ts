import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/connection/knowledge/${encodeURIComponent(id)}`, "DELETE")
}
