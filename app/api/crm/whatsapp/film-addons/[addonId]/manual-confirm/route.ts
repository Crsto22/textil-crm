import { NextRequest } from "next/server"

import { proxyWhatsappRequest } from "@/app/api/crm/whatsapp/_proxy"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ addonId: string }> },
) {
  const { addonId } = await params
  return proxyWhatsappRequest(
    request,
    `/api/crm/whatsapp/film-addons/${addonId}/manual-confirm`,
    "POST",
  )
}
