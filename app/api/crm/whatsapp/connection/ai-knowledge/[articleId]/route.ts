import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "@/app/api/crm/whatsapp/_proxy"

export async function PUT(request: NextRequest, context: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/connection/ai-knowledge/${articleId}`, "PUT")
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/connection/ai-knowledge/${articleId}`, "DELETE")
}
