import { NextRequest } from "next/server"
import { proxyWhatsappRequest } from "../../../_proxy"

export async function POST(request: NextRequest, context: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/film-evidences/${evidenceId}/decision`, "POST")
}
