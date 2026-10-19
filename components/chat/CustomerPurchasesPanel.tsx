"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowPathIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline"

import { Button } from "@/components/ui/button"
import { authFetch } from "@/lib/auth/auth-fetch"

type PurchaseFilter = "TODAS" | "EMITIDA" | "ANULADA" | "NC_EMITIDA"

interface SaleDetail {
  idProductoVariante: number
  nombre: string
  sku: string | null
  color: string | null
  talla: string | null
  cantidad: number
  total: number
}

interface SalePayment {
  idMetodoPago: number
  metodoPago: string
  monto: number
}

interface SaleDelivery {
  metodo: string | null
  estado: string | null
  sucursalRecojo: string | null
  agenciaShalom: string | null
  direccionShalom: string | null
}

interface CustomerSale {
  idVenta: number
  fecha: string
  tipoComprobante: string
  serie: string
  correlativo: number
  moneda: string
  total: number
  estado: string
  idSucursal: number
  nombreSucursal: string
  origen: string | null
  vendedor: string | null
  entrega: SaleDelivery | null
  estadoFilm: string | null
  detalles: SaleDetail[]
  pagos: SalePayment[]
}

interface PagedSales {
  content: CustomerSale[]
  page: number
  size: number
  totalPages: number
  totalElements: number
  numberOfElements: number
  first: boolean
  last: boolean
  empty: boolean
}

interface PurchasesSummary {
  comprasEmitidas: number
  montoTotal: number
  prendasCompradas: number
  ultimaCompra: string | null
}

interface ProductSummary {
  idProductoVariante: number
  nombre: string
  sku: string | null
  color: string | null
  talla: string | null
  cantidad: number
  monto: number
}

interface PaymentSummary {
  idMetodoPago: number
  metodoPago: string
  cantidad: number
  monto: number
}

interface CustomerPurchasesResponse {
  clienteVinculado: boolean
  historial: PagedSales
  resumen: PurchasesSummary
  productosTop: ProductSummary[]
  metodosPago: PaymentSummary[]
}

interface CustomerPurchasesPanelProps {
  conversationId: string
  refreshKey?: number
  onCountChange?: (count: number) => void
}

const filters: Array<{ value: PurchaseFilter; label: string }> = [
  { value: "TODAS", label: "Todas" },
  { value: "EMITIDA", label: "Emitidas" },
  { value: "ANULADA", label: "Anuladas" },
  { value: "NC_EMITIDA", label: "Con nota de crédito" },
]

function money(value: number | null | undefined, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: currency || "PEN",
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Sin compras"
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function saleNumber(sale: CustomerSale) {
  const number = String(sale.correlativo ?? "").padStart(6, "0")
  return `${sale.serie || sale.tipoComprobante || "Venta"}-${number}`
}

function statusStyle(status: string) {
  const normalized = status?.toUpperCase()
  if (normalized === "EMITIDA") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
  if (normalized === "ANULADA") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
  if (normalized === "NC_EMITIDA") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null)
  return body?.message || body?.detail || body?.error || "No se pudieron cargar las compras"
}

export function CustomerPurchasesPanel({
  conversationId,
  refreshKey = 0,
  onCountChange,
}: CustomerPurchasesPanelProps) {
  const [filter, setFilter] = useState<PurchaseFilter>("TODAS")
  const [page, setPage] = useState(0)
  const [data, setData] = useState<CustomerPurchasesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadPurchases = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ page: String(page) })
      if (filter !== "TODAS") query.set("estado", filter)
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/sales?${query}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(await readError(response))
      const result = (await response.json()) as CustomerPurchasesResponse
      if (controller.signal.aborted) return
      setData(result)
      onCountChange?.(result.resumen.comprasEmitidas)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar las compras")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [conversationId, filter, onCountChange, page])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadPurchases(), 0)
    return () => {
      window.clearTimeout(timeoutId)
      abortRef.current?.abort()
    }
  }, [loadPurchases, refreshKey])

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string | number }>).detail
      if (detail?.conversationId && String(detail.conversationId) !== conversationId) return
      void loadPurchases()
    }
    window.addEventListener("crm-payment-event", refresh)
    window.addEventListener("crm-sale-event", refresh)
    return () => {
      window.removeEventListener("crm-payment-event", refresh)
      window.removeEventListener("crm-sale-event", refresh)
    }
  }, [conversationId, loadPurchases])

  const pageLabel = useMemo(() => {
    if (!data?.historial.totalPages) return "Página 0 de 0"
    return `Página ${data.historial.page + 1} de ${data.historial.totalPages}`
  }, [data])

  if (!loading && data && !data.clienteVinculado) {
    return (
      <PanelState
        icon={<ShoppingBagIcon className="h-7 w-7" />}
        title="Cliente no vinculado"
        description="Registra o vincula al cliente para consultar sus compras."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Compras del cliente</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Historial informativo de todas las sucursales</p>
          </div>
          <button
            type="button"
            onClick={() => void loadPurchases()}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Actualizar compras"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SummaryCard icon={ShoppingBagIcon} label="Compras realizadas" value={String(data?.resumen.comprasEmitidas ?? 0)} tone="emerald" />
          <SummaryCard icon={BanknotesIcon} label="Monto comprado" value={money(data?.resumen.montoTotal)} tone="blue" />
          <SummaryCard icon={CubeIcon} label="Prendas compradas" value={String(data?.resumen.prendasCompradas ?? 0)} tone="violet" />
          <SummaryCard icon={CalendarDaysIcon} label="Última compra" value={dateTime(data?.resumen.ultimaCompra)} tone="amber" compact />
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setFilter(item.value)
                setPage(0)
                setExpandedSaleId(null)
              }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                filter === item.value
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && !data ? <PanelLoading /> : null}
        {error ? (
          <PanelState
            icon={<ExclamationTriangleIcon className="h-7 w-7" />}
            title="No se pudieron cargar las compras"
            description={error}
            action={<Button variant="outline" size="sm" onClick={() => void loadPurchases()}>Reintentar</Button>}
          />
        ) : null}
        {!loading && !error && data?.historial.empty && filter === "TODAS" ? (
          <PanelState
            icon={<ReceiptPercentIcon className="h-7 w-7" />}
            title="Sin compras registradas"
            description="Este cliente todavía no tiene ventas vinculadas."
          />
        ) : null}
        {!loading && !error && data?.historial.empty && filter !== "TODAS" ? (
          <PanelState
            icon={<ReceiptPercentIcon className="h-7 w-7" />}
            title="Página sin resultados"
            description="No hay ventas para este filtro."
          />
        ) : null}

        {!error && data && !data.historial.empty ? (
          <div className="space-y-2.5">
            {data.historial.content.map((sale) => (
              <PurchaseCard
                key={sale.idVenta}
                sale={sale}
                expanded={expandedSaleId === sale.idVenta}
                onToggle={() => setExpandedSaleId((current) => current === sale.idVenta ? null : sale.idVenta)}
              />
            ))}
          </div>
        ) : null}

        {!error && data && (data.productosTop.length > 0 || data.metodosPago.length > 0) ? (
          <section className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resumen histórico</p>
            {data.productosTop.length > 0 ? (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-foreground">Más comprados</p>
                <div className="mt-1 space-y-1">
                  {data.productosTop.slice(0, 3).map((item) => (
                    <div key={item.idProductoVariante} className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span className="truncate">{item.nombre}{item.color ? ` · ${item.color}` : ""}{item.talla ? ` · ${item.talla}` : ""}</span>
                      <span className="shrink-0 font-semibold text-foreground">{item.cantidad} prendas</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {data.metodosPago.length > 0 ? (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Métodos usados: {data.metodosPago.map((item) => item.metodoPago).join(", ")}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      {data && data.historial.totalPages > 0 ? (
        <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={data.historial.first || loading}
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-35"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" /> Anterior
          </button>
          <span className="text-[10px] font-medium text-muted-foreground">{pageLabel}</span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={data.historial.last || loading}
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-35"
          >
            Siguiente <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function PurchaseCard({ sale, expanded, onToggle }: { sale: CustomerSale; expanded: boolean; onToggle: () => void }) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <button type="button" onClick={onToggle} className="w-full p-3 text-left transition hover:bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-foreground">{saleNumber(sale)}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{dateTime(sale.fecha)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusStyle(sale.estado)}`}>{sale.estado}</span>
            <ChevronDownIcon className={`h-3.5 w-3.5 text-muted-foreground transition ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">
            {sale.detalles.map((item) => `${item.cantidad} ${item.nombre}`).join(" · ") || "Sin detalle de productos"}
          </p>
          <p className="shrink-0 text-sm font-bold text-foreground">{money(sale.total, sale.moneda)}</p>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border bg-muted/15 px-3 py-3 text-[10px]">
          <section>
            <p className="font-bold uppercase tracking-wider text-muted-foreground">Productos</p>
            <div className="mt-1.5 space-y-1.5">
              {sale.detalles.map((item, index) => (
                <div key={`${item.idProductoVariante}-${index}`} className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{item.cantidad} × {item.nombre}</p>
                    <p className="truncate text-muted-foreground">{[item.color, item.talla, item.sku].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-foreground">{money(item.total, sale.moneda)}</span>
                </div>
              ))}
            </div>
          </section>

          <DetailRow label="Métodos de pago" value={sale.pagos.length ? sale.pagos.map((payment) => `${payment.metodoPago} (${money(payment.monto, sale.moneda)})`).join(" · ") : "No registrado"} />
          <DetailRow label="Sucursal" value={sale.nombreSucursal || "No registrado"} />
          <DetailRow label="Origen" value={[sale.origen, sale.vendedor].filter(Boolean).join(" · ") || "No registrado"} />
          <DetailRow label="Entrega" value={deliveryLabel(sale.entrega)} />
          {sale.entrega?.agenciaShalom ? <DetailRow label="Agencia" value={sale.entrega.agenciaShalom} /> : null}
          {sale.entrega?.direccionShalom ? <DetailRow label="Dirección Shalom" value={sale.entrega.direccionShalom} /> : null}
          {sale.entrega?.sucursalRecojo ? <DetailRow label="Recojo" value={sale.entrega.sucursalRecojo} /> : null}
          <DetailRow label="Film protector" value={sale.estadoFilm || "No registrado"} />
        </div>
      ) : null}
    </article>
  )
}

function deliveryLabel(delivery: SaleDelivery | null) {
  if (!delivery) return "No registrado"
  return [delivery.metodo, delivery.estado].filter(Boolean).join(" · ") || "No registrado"
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border/70 pt-2">
      <span className="shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, tone, compact = false }: {
  icon: typeof ShoppingBagIcon
  label: string
  value: string
  tone: "emerald" | "blue" | "violet" | "amber"
  compact?: boolean
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  }
  return (
    <div className="rounded-xl border border-border bg-background p-2.5 shadow-sm">
      <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`${compact ? "text-[10px] leading-4" : "text-sm"} mt-0.5 font-bold text-foreground`}>{value}</p>
    </div>
  )
}

function PanelLoading() {
  return (
    <div className="flex min-h-[180px] flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
      <ArrowPathIcon className="h-4 w-4 animate-spin" />
      Cargando compras...
    </div>
  )
}

function PanelState({ icon, title, description, action }: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center text-muted-foreground">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">{icon}</div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
