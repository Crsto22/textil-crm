import { NextRequest } from "next/server"
import { proxyDocumentoRequest } from "../../_proxy"

export async function GET(request: NextRequest, { params }: { params: Promise<{ dni: string }> }) {
  const { dni } = await params
  return proxyDocumentoRequest(request, `/api/documento/dni/${encodeURIComponent(dni)}`)
}
