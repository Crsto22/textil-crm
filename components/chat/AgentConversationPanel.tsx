"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPathIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  MapPinIcon,
  ShoppingCartIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline"

import { Button } from "@/components/ui/button"
import { authFetch } from "@/lib/auth/auth-fetch"

interface AgentSummary {
  hasSession: boolean
  toolHistoryVisible: boolean
  session: null | {
    id: number
    state: string | null
    resumeState: string | null
    lastEvent: string | null
    summary: string | null
    active: boolean
    startedAt: string | null
    lastActivityAt: string | null
    stateChangedAt: string | null
    completedAt: string | null
  }
  customer: null | {
    id: number
    names: string
    phone: string | null
    documentType: string | null
    documentNumber: string | null
    email: string | null
    address: string | null
  }
  cart: {
    id: number | null
    status: string
    currency: string
    subtotal: number
    discountTotal: number
    total: number
    items: Array<{
      id: number
      variantId: number
      product: string
      color: string
      size: string
      quantity: number
      unitPrice: number
      lineTotal: number
    }>
    promotions: Array<{
      id: number
      promotionId: number
      name: string
      quantity: number
      comboPrice: number
      discountAmount: number
    }>
  }
  payment: null | {
    id: number
    status: string
    reservationStatus: string
    method: string | null
    maskedAccount: string | null
    accountHolder: string | null
    expectedAmount: number
    currency: string
    reservedAt: string | null
    expiresAt: string | null
    remainingSeconds: number
    evidenceAcceptedAt: string | null
    reviewExpiresAt: string | null
    releasedAt: string | null
    releaseReason: string | null
    evidence: null | {
      id: number
      validationStatus: string
      processingStatus: string
      detectedProvider: string | null
      detectedAmount: number | null
      detectedCurrency: string | null
      operationCode: string | null
      operationAt: string | null
      recipient: string | null
      confidence: number | null
      extractedText: string | null
      warningsJson: string | null
      reviewNote: string | null
      mediaUrl: string
    }
  }
  fulfillment: null | {
    id: number
    method: string
    status: string
    recipientName: string | null
    documentType: string | null
    documentNumber: string | null
    phone: string | null
    pickupBranchId: number | null
    shalomAgencyId: number | null
    shalomAgency: string | null
    shalomDestination: string | null
    shalomAgencyAddress: string | null
    shalomCandidateIds: string | null
  }
  sale: null | {
    id: number
    documentType: string
    series: string
    number: number
    total: number
    currency: string
    status: string
    origin: string
    createdAt: string | null
    cancellationReason: string | null
  }
  supportCases: Array<{
    id: number
    category: string
    reason: string
    summary: string | null
    priority: string
    status: string
    assignedUser: string | null
    resolutionNote: string | null
    openedAt: string | null
  }>
  toolCalls: Array<{
    id: number
    jobId: number | null
    name: string
    status: string
    requestJson: string | null
    responseJson: string | null
    errorCode: string | null
    errorMessage: string | null
    startedAt: string | null
    completedAt: string | null
    createdAt: string | null
  }>
  generatedAt: string
}

interface AgentConversationPanelProps {
  conversationId: string
  isAdmin: boolean
}

const stateLabels: Record<string, string> = {
  IDLE: "Sin actividad",
  EXPLORANDO_PRODUCTOS: "Explorando productos",
  ARMANDO_CARRITO: "Armando carrito",
  ESPERANDO_DATOS_CLIENTE: "Esperando datos del cliente",
  ESPERANDO_METODO_PAGO: "Esperando método de pago",
  ESPERANDO_COMPROBANTE: "Esperando comprobante",
  VALIDANDO_COMPROBANTE: "Validando comprobante",
  ESPERANDO_METODO_ENTREGA: "Esperando método de entrega",
  ESPERANDO_DATOS_SHALOM: "Esperando datos de Shalom",
  ESPERANDO_CONFIRMACION_AGENCIA_SHALOM: "Esperando confirmación de agencia Shalom",
  LISTO_PARA_VENTA: "Listo para generar venta",
  VENTA_PENDIENTE_REVISION: "Venta pendiente de revisión",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
  REQUIERE_AYUDA: "Requiere ayuda",
}

function label(value: string | null | undefined) {
  if (!value) return "Pendiente"
  return stateLabels[value] ?? value.replaceAll("_", " ").toLowerCase().replace(/^./, (text) => text.toUpperCase())
}

function money(value: number | null | undefined, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: currency || "PEN" }).format(Number(value ?? 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })
}

function timerLabel(seconds: number) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`
}

function StatusPill({ value, warning = false }: { value: string; warning?: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${warning
      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"}`}>
      {label(value)}
    </span>
  )
}

function PanelSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-background p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground">
        <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  )
}

export function AgentConversationPanel({ conversationId, isAdmin }: AgentConversationPanelProps) {
  const [summary, setSummary] = useState<AgentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError("")
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/agent-summary`, { cache: "no-store" })
      if (!response.ok) throw new Error("No se pudo cargar el estado del agente")
      setSummary((await response.json()) as AgentSummary)
      setNow(Date.now())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error inesperado")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [conversationId])

  useEffect(() => {
    const initialId = window.setTimeout(() => void load(), 0)
    const refreshId = window.setInterval(() => void load(true), 5000)
    const clockId = window.setInterval(() => setNow(Date.now()), 1000)
    const refresh = () => void load(true)
    const refreshConversation = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: number }>).detail
      if (String(detail?.conversationId ?? "") === conversationId) void load(true)
    }
    window.addEventListener("crm-payment-event", refresh)
    window.addEventListener("crm-agent-event", refreshConversation)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearTimeout(initialId)
      window.clearInterval(refreshId)
      window.clearInterval(clockId)
      window.removeEventListener("crm-payment-event", refresh)
      window.removeEventListener("crm-agent-event", refreshConversation)
      window.removeEventListener("focus", refresh)
    }
  }, [conversationId, load])

  const remainingSeconds = useMemo(() => {
    const expiresAt = summary?.payment?.expiresAt
    if (!expiresAt) return 0
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
  }, [now, summary?.payment?.expiresAt])

  if (loading) {
    return <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"><ArrowPathIcon className="h-4 w-4 animate-spin" />Cargando agente...</div>
  }
  if (error) {
    return <div className="m-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><p>{error}</p><Button variant="outline" className="mt-3 h-8 w-full text-xs" onClick={() => void load()}>Reintentar</Button></div>
  }
  if (!summary?.hasSession || !summary.session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <SparklesIcon className="h-9 w-9 text-slate-300" />
        <p className="mt-3 text-sm font-semibold">Sin sesión del agente</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Esta conversación todavía no ha sido procesada por el nuevo agente.</p>
      </div>
    )
  }

  const { session, cart, customer, payment, fulfillment, sale } = summary
  const stateWarning = session.state === "REQUIERE_AYUDA" || session.state === "CANCELADO"

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
      <div className="mb-3 flex items-start justify-between gap-2 rounded-xl bg-slate-950 p-3 text-white dark:bg-slate-800">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Estado actual</p>
          <p className="mt-1 text-sm font-bold">{label(session.state)}</p>
          <p className="mt-1 truncate text-[10px] text-slate-400">Última actividad: {formatDate(session.lastActivityAt)}</p>
        </div>
        <button type="button" onClick={() => void load(true)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" title="Actualizar">
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-2.5">
        <PanelSection title="Sesión del agente" icon={<SparklesIcon className="h-4 w-4" />}>
          <div className="flex items-center justify-between gap-2"><StatusPill value={session.state ?? "IDLE"} warning={stateWarning} /><span className="text-[10px] text-muted-foreground">#{session.id}</span></div>
          {session.lastEvent ? <p className="mt-2 text-[11px] text-muted-foreground">Último evento: <span className="font-medium text-foreground">{label(session.lastEvent)}</span></p> : null}
          {session.summary ? <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">{session.summary}</p> : null}
        </PanelSection>

        <PanelSection title="Carrito" icon={<ShoppingCartIcon className="h-4 w-4" />}>
          {cart.items.length === 0 ? <p className="text-[11px] text-muted-foreground">El carrito está vacío.</p> : (
            <div className="space-y-2">
              {cart.items.map((item) => <div key={item.id} className="flex justify-between gap-2 border-b border-border pb-2 text-[11px] last:border-0 last:pb-0"><div><p className="font-semibold">{item.quantity} × {item.product}</p><p className="text-muted-foreground">{item.color} · talla {item.size}</p></div><span className="shrink-0 font-semibold">{money(item.lineTotal, cart.currency)}</span></div>)}
              {cart.promotions.map((promotion) => <p key={promotion.id} className="rounded-lg bg-violet-50 px-2 py-1.5 text-[10px] text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">🎁 {promotion.name} · ahorro {money(promotion.discountAmount, cart.currency)}</p>)}
              <div className="grid grid-cols-2 gap-1 border-t border-border pt-2 text-[11px]"><span className="text-muted-foreground">Descuento</span><span className="text-right">-{money(cart.discountTotal, cart.currency)}</span><span className="font-bold">Total</span><span className="text-right font-bold">{money(cart.total, cart.currency)}</span></div>
            </div>
          )}
        </PanelSection>

        <PanelSection title="Datos del cliente" icon={<IdentificationIcon className="h-4 w-4" />}>
          {customer ? <div className="space-y-1 text-[11px]"><p className="font-semibold">{customer.names}</p><p className="text-muted-foreground">{customer.phone || "Celular pendiente"}</p><p className="text-muted-foreground">{customer.documentNumber ? `${customer.documentType}: ${customer.documentNumber}` : "Documento pendiente"}</p></div> : <p className="text-[11px] text-amber-700 dark:text-amber-300">Datos del cliente pendientes.</p>}
        </PanelSection>

        <PanelSection title="Reserva y pago" icon={<BanknotesIcon className="h-4 w-4" />}>
          {payment ? <div className="space-y-2 text-[11px]"><div className="flex items-center justify-between"><StatusPill value={payment.status} warning={payment.status === "EXPIRED" || payment.status === "CANCELLED"} />{payment.reservationStatus === "ACTIVE" && !payment.evidenceAcceptedAt && payment.status === "PENDING_EVIDENCE" ? <span className="flex items-center gap-1 font-mono text-sm font-bold text-amber-600"><ClockIcon className="h-4 w-4" />{timerLabel(remainingSeconds)}</span> : null}</div><p><span className="text-muted-foreground">Monto:</span> <strong>{money(payment.expectedAmount, payment.currency)}</strong></p><p><span className="text-muted-foreground">Método:</span> {payment.method || "Pendiente"}{payment.maskedAccount ? ` · ${payment.maskedAccount}` : ""}</p><p><span className="text-muted-foreground">Reserva:</span> {label(payment.reservationStatus)}</p>{payment.evidenceAcceptedAt ? <p className="text-emerald-600">Comprobante aceptado: {formatDate(payment.evidenceAcceptedAt)}</p> : null}{payment.releaseReason ? <p className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{payment.releaseReason}</p> : null}</div> : <p className="text-[11px] text-muted-foreground">Todavía no existe una solicitud de pago.</p>}
        </PanelSection>

        {payment?.evidence ? <PanelSection title="Comprobante y validación inicial" icon={<ClipboardDocumentCheckIcon className="h-4 w-4" />}><div className="space-y-2 text-[11px]"><div className="flex items-center justify-between"><StatusPill value={payment.evidence.validationStatus} warning={payment.evidence.validationStatus === "OBSERVADO" || payment.evidence.validationStatus === "RECHAZADO"} />{payment.evidence.confidence != null ? <span className="font-semibold">{payment.evidence.confidence}% confianza</span> : null}</div><p><span className="text-muted-foreground">Detectado:</span> {money(payment.evidence.detectedAmount, payment.evidence.detectedCurrency || payment.currency)} · {payment.evidence.detectedProvider || "proveedor pendiente"}</p>{payment.evidence.operationCode ? <p><span className="text-muted-foreground">Operación:</span> {payment.evidence.operationCode}</p> : null}{payment.evidence.recipient ? <p><span className="text-muted-foreground">Destinatario:</span> {payment.evidence.recipient}</p> : null}<a href={payment.evidence.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex font-semibold text-emerald-600 hover:underline">Ver comprobante</a>{payment.evidence.reviewNote ? <p className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{payment.evidence.reviewNote}</p> : null}</div></PanelSection> : null}

        <PanelSection title="Entrega" icon={<MapPinIcon className="h-4 w-4" />}>
          {fulfillment ? <div className="space-y-1 text-[11px]"><div className="mb-2 flex items-center justify-between"><strong>{label(fulfillment.method)}</strong><StatusPill value={fulfillment.status} /></div><p>{fulfillment.recipientName || "Nombre pendiente"} · {fulfillment.phone || "celular pendiente"}</p>{fulfillment.method === "SHALOM" ? <><p className="text-muted-foreground">{fulfillment.shalomDestination || "Destino pendiente"} · {fulfillment.shalomAgency || "agencia pendiente"}</p>{fulfillment.shalomAgencyAddress && <p className="text-muted-foreground">{fulfillment.shalomAgencyAddress}</p>}</> : <p className="text-muted-foreground">Sucursal #{fulfillment.pickupBranchId ?? "pendiente"}</p>}</div> : <p className="text-[11px] text-muted-foreground">Modalidad de entrega pendiente.</p>}
        </PanelSection>

        <PanelSection title="Nota de Venta" icon={<CheckBadgeIcon className="h-4 w-4" />}>
          {sale ? <div className="space-y-1 text-[11px]"><div className="flex items-center justify-between"><strong>{sale.series}-{String(sale.number).padStart(6, "0")}</strong><StatusPill value={sale.status} warning={sale.status === "ANULADA"} /></div><p>{sale.documentType} · {money(sale.total, sale.currency)}</p><p className="text-muted-foreground">Origen {sale.origin} · {formatDate(sale.createdAt)}</p>{sale.cancellationReason ? <p className="text-red-600">{sale.cancellationReason}</p> : null}</div> : <p className="text-[11px] text-muted-foreground">Aún no se generó la Nota de Venta.</p>}
        </PanelSection>

        {summary.supportCases.length > 0 ? <PanelSection title="Casos con problemas" icon={<ExclamationTriangleIcon className="h-4 w-4" />}><div className="space-y-2">{summary.supportCases.map((supportCase) => <div key={supportCase.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] dark:border-amber-500/20 dark:bg-amber-500/10"><div className="flex justify-between gap-2"><strong>{label(supportCase.category)}</strong><StatusPill value={supportCase.status} warning /></div><p className="mt-1">{supportCase.reason}</p>{supportCase.summary ? <p className="mt-1 text-muted-foreground">{supportCase.summary}</p> : null}</div>)}</div></PanelSection> : null}

        {isAdmin && summary.toolHistoryVisible ? <PanelSection title="Historial de herramientas" icon={<CodeBracketSquareIcon className="h-4 w-4" />}><div className="space-y-2">{summary.toolCalls.length === 0 ? <p className="text-[11px] text-muted-foreground">Sin llamadas registradas.</p> : summary.toolCalls.map((tool) => <details key={tool.id} className="rounded-lg border border-border p-2 text-[10px]"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{tool.name}</span><StatusPill value={tool.status} warning={tool.status === "FAILED"} /></div><p className="mt-1 text-muted-foreground">#{tool.id} · {formatDate(tool.createdAt)}</p></summary>{tool.errorMessage ? <p className="mt-2 text-red-600">{tool.errorCode ? `${tool.errorCode}: ` : ""}{tool.errorMessage}</p> : null}{tool.requestJson ? <><p className="mt-2 font-semibold">Entrada</p><pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2">{tool.requestJson}</pre></> : null}{tool.responseJson ? <><p className="mt-2 font-semibold">Resultado</p><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2">{tool.responseJson}</pre></> : null}</details>)}</div></PanelSection> : null}
      </div>
    </div>
  )
}
