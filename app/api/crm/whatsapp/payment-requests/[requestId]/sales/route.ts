import { NextRequest } from "next/server"

import { proxyWhatsappRequest } from "../../../_proxy"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/payment-requests/${requestId}/sales`, "POST")
}
