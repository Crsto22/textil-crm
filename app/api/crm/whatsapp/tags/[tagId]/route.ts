import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../_proxy"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> },
) {
  const { tagId } = await params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/tags/${tagId}`, "PUT")
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> },
) {
  const { tagId } = await params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/tags/${tagId}`, "DELETE")
}
