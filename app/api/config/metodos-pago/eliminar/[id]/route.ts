import { NextRequest } from "next/server"
import { proxyBackendRequest } from "../../../../_backend-proxy"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  return proxyBackendRequest(request, `/api/config/metodos-pago/eliminar/${encodeURIComponent(id)}`, "DELETE")
}
