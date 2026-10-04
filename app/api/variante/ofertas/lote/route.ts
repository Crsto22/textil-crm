import { NextRequest } from "next/server"
import { proxyBackendRequest } from "../../../_backend-proxy"

export async function PATCH(request: NextRequest) {
  return proxyBackendRequest(request, "/api/variante/ofertas/lote", "PATCH")
}
