import { NextRequest } from "next/server"
import { proxyBackendRequest } from "../../_backend-proxy"

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, "/api/ecommerce/promociones-combo", "GET")
}

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, "/api/ecommerce/promociones-combo", "POST")
}
