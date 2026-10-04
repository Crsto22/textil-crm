import { NextRequest } from "next/server"
import { proxyBackendRequest } from "../../../_backend-proxy"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  return proxyBackendRequest(request, `/api/config/metodos-pago/${encodeURIComponent(id)}`, "PUT")
}
