import { NextRequest } from "next/server"
import { proxyDocumentoRequest } from "../../_proxy"

export async function GET(request: NextRequest, { params }: { params: Promise<{ ruc: string }> }) {
  const { ruc } = await params
  return proxyDocumentoRequest(request, `/api/documento/ruc/${encodeURIComponent(ruc)}`)
}
