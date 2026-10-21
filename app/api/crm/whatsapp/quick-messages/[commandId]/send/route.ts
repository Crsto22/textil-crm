import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commandId: string }> },
) {
  const { commandId } = await params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/quick-messages/${commandId}/send`, "POST")
}
