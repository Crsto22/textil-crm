import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

export async function GET(request: NextRequest, context: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/payment-evidences/${evidenceId}/media`, "GET")
}
