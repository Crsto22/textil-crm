import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../../../_proxy"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ commandId: string; blockId: string }> },
) {
  const { commandId, blockId } = await params
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/quick-messages/${commandId}/blocks/${blockId}/media`,
    "GET",
  )
}
