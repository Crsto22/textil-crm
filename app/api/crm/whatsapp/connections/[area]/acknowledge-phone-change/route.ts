import { proxyWhatsappRequest } from "@/app/api/crm/whatsapp/_proxy"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest, context: { params: Promise<{ area: string }> }) {
  const { area } = await context.params
  return proxyWhatsappRequest(request, `/api/crm/whatsapp/connections/${encodeURIComponent(area)}/acknowledge-phone-change`, "POST")
}
