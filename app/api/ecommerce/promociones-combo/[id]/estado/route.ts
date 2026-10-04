import { NextRequest } from "next/server"
import { proxyBackendRequest } from "../../../../_backend-proxy"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  return proxyBackendRequest(request, `/api/ecommerce/promociones-combo/${encodeURIComponent(id)}/estado`, "PATCH")
}
