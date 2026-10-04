import { NextRequest } from "next/server"

import { proxyWhatsappRequest } from "@/app/api/crm/whatsapp/_proxy"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/payment-evidences/${evidenceId}/decision`,
    "POST",
  )
}
