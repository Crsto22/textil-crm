import type { NextRequest } from "next/server"

import { proxyWhatsappRequest } from "../../whatsapp/_proxy"

type RouteContext = { params: Promise<{ segments: string[] }> }

async function forward(request: NextRequest, context: RouteContext, method: "GET" | "POST" | "PATCH") {
  const { segments } = await context.params
  const suffix = segments.map(encodeURIComponent).join("/")
  return proxyWhatsappRequest(request, `/api/crm/warehouse/${suffix}${request.nextUrl.search}`, method)
}

export function GET(request: NextRequest, context: RouteContext) {
  return forward(request, context, "GET")
}

export function POST(request: NextRequest, context: RouteContext) {
  return forward(request, context, "POST")
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, context, "PATCH")
}
