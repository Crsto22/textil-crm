import { NextRequest } from "next/server"
import { proxyBackendRequest } from "../../_backend-proxy"

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, "/api/config/metodos-pago", "GET")
}

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, "/api/config/metodos-pago", "POST")
}
