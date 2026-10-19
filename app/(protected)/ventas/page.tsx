"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import {
  ArrowPathIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LoaderSpinner } from "@/components/ui/loader-spinner"
import { authFetch } from "@/lib/auth/auth-fetch"
import { cn } from "@/lib/utils"

type ReviewFilter = "ALL" | "PENDING" | "ACCEPTED" | "REJECTED"

interface SaleItem {
  description: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
}

interface CrmSale {
  saleId: number
  receiptType: string
  number: string
  total: number
  currency: string
  saleStatus: string
  createdAt: string
  cancellationReason: string | null
  branch: string
  customerName: string | null
  customerPhone: string | null
  conversationId: number | null
  whatsappPhone: string | null
  source: "CRM" | "IA_KIMENTS"
  paymentRequestId: number | null
  paymentRequestStatus: string | null
  evidenceId: number | null
  mainEvidenceStatus: string | null
  reviewStatus: "NO_EVIDENCE" | "PROCESSING" | "PENDING" | "ACCEPTED" | "REJECTED"
  processingStatus: string | null
  detectedAmount: number | null
  detectedProvider: string | null
  operationCode: string | null
  operationAt: string | null
  confidence: number | null
  reviewNote: string | null
  reviewedAt: string | null
  paymentMethod: string | null
  deliveryMethod: "PICKUP" | "SHALOM" | null
  shalomAgency: string | null
  shalomAgencyAddress: string | null
  filmAddonId: number | null
  filmStatus: string | null
  filmAmount: number | null
  filmExpiresAt: string | null
  filmResolutionSource: string | null
  coveredBySaleId: number | null
  filmResolvedAt: string | null
  filmResolvedBy: string | null
  filmEvidence: FilmEvidence | null
  items: SaleItem[]
}

interface FilmEvidence {
  evidenceId: number
  validationStatus: string
  processingStatus: string
  detectedAmount: number | null
  operationCode: string | null
  operationAt: string | null
  confidence: number | null
  reviewNote: string | null
  reviewedAt: string | null
  mediaUrl: string
}

interface SalesPage {
  content: CrmSale[]
  totalElements: number
  page: number
  size: number
  totalPages: number
}

interface EvidenceDetail {
  idPaymentEvidence: number
  amount: number | null
  currency: string | null
  operationCode: string | null
  operationAt: string | null
  provider: string | null
  confidence: number | null
  warnings: string[]
}

const filters: Array<{ value: ReviewFilter; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "PENDING", label: "Por validar" },
  { value: "ACCEPTED", label: "Aceptadas" },
  { value: "REJECTED", label: "Anuladas" },
]

function money(value: number | null | undefined) {
  return `S/ ${Number(value ?? 0).toFixed(2)}`
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "-"
}

function reviewLabel(status: CrmSale["reviewStatus"]) {
  if (status === "PENDING") return "Por validar"
  if (status === "ACCEPTED") return "Pago aceptado"
  if (status === "REJECTED") return "Venta anulada"
  if (status === "PROCESSING") return "Procesando"
  return "Sin comprobante"
}

function deliveryLabel(method: CrmSale["deliveryMethod"]) {
  if (method === "PICKUP") return "Recojo en tienda"
  if (method === "SHALOM") return "Envío por Shalom"
  return "Sin definir"
}

function filmLabel(status: string | null) {
  if (status === "CONFIRMED") return "Pagado"
  if (status === "COVERED_BY_PREVIOUS_ORDER") return "Cubierto por pedido anterior"
  if (status === "ADVISOR_REVIEW_REQUIRED") return "Pendiente de revisión"
  if (status === "AWAITING_PREVIOUS_ORDER_DECISION") return "Esperando respuesta"
  if (status === "AWAITING_PAYMENT") return "Pendiente de pago"
  if (status === "PAYMENT_OVERDUE") return "Vencido"
  if (status === "PAYMENT_CONFIGURATION_REQUIRED") return "Revisión requerida"
  return status || "Sin film"
}

function useProtectedMedia(path?: string, enabled = false) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!path || !enabled) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    void authFetch(path, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el comprobante")
        return response.blob()
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((error) => {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "No se pudo cargar el comprobante")
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(undefined)
    }
  }, [enabled, path])
  return url
}

function ReviewDialog({ sale, open, onOpenChange, onUpdated }: {
  sale: CrmSale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}) {
  const [detail, setDetail] = useState<EvidenceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [filmLoading, setFilmLoading] = useState(false)
  const [filmRejecting, setFilmRejecting] = useState(false)
  const [filmReason, setFilmReason] = useState("")
  const [filmDecision, setFilmDecision] = useState<"ACCEPT" | "REJECT" | null>(null)
  const [showFilmReview, setShowFilmReview] = useState(false)
  const mediaUrl = useProtectedMedia(
    sale?.evidenceId ? `/api/crm/whatsapp/payment-evidences/${sale.evidenceId}/media` : undefined,
    open,
  )
  const filmMediaUrl = useProtectedMedia(sale?.filmEvidence?.mediaUrl, open)

  useEffect(() => {
    if (!open || !sale?.evidenceId) return
    const controller = new AbortController()
    void authFetch(`/api/crm/whatsapp/payment-evidences/${sale.evidenceId}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los datos del pago")
        return response.json() as Promise<EvidenceDetail>
      })
      .then(setDetail)
      .catch((error) => {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "No se pudo cargar el pago")
      })
    return () => controller.abort()
  }, [open, sale?.evidenceId])

  const decide = async (action: "ACCEPT" | "REJECT") => {
    if (!sale?.evidenceId || loading) return
    if (action === "REJECT" && reason.trim().length < 5) {
      toast.error("Escribe un motivo de al menos 5 caracteres")
      return
    }
    setLoading(true)
    try {
      const response = await authFetch(`/api/crm/whatsapp/payment-evidences/${sale.evidenceId}/decision`, {
        method: "POST",
        body: JSON.stringify({
          action,
          confirmedExternal: action === "ACCEPT",
          note: action === "REJECT" ? reason.trim() : null,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "No se pudo validar el pago")
      }
      toast.success(action === "ACCEPT"
        ? "Pago aceptado. La venta se mantiene registrada."
        : "Pago rechazado. La venta fue anulada y el stock fue devuelto.")
      onOpenChange(false)
      onUpdated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo validar el pago")
    } finally {
      setLoading(false)
    }
  }

  const decideFilm = async (action: "ACCEPT" | "REJECT") => {
    if (!sale?.filmEvidence?.evidenceId || filmLoading) return
    if (action === "REJECT" && filmReason.trim().length < 5) {
      toast.error("Escribe un motivo de al menos 5 caracteres")
      return
    }
    setFilmLoading(true)
    try {
      const response = await authFetch(`/api/crm/whatsapp/film-evidences/${sale.filmEvidence.evidenceId}/decision`, {
        method: "POST",
        body: JSON.stringify({ action, confirmedExternal: action === "ACCEPT", note: action === "REJECT" ? filmReason.trim() : null }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "No se pudo revisar el pago del film")
      }
      toast.success(action === "ACCEPT" ? "Film protector confirmado. Ahora revisa el pago principal." : "Film retirado. Ahora revisa el pago principal.")
      setFilmDecision(action)
      setShowFilmReview(false)
      setFilmRejecting(false)
      setFilmReason("")
      onUpdated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo revisar el pago del film")
    } finally { setFilmLoading(false) }
  }

  const canReview = sale?.mainEvidenceStatus === "ACEPTABLE" && sale.saleStatus !== "ANULADA"
  const canReviewFilm = sale?.filmEvidence?.validationStatus === "ACEPTABLE" && sale.saleStatus !== "ANULADA"
  const filmRequiresReview = Boolean(canReviewFilm && !filmDecision)
  const hasFilmEvidence = Boolean(sale?.filmEvidence)
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!loading && !filmLoading) onOpenChange(next)
      if (!next) {
        setDetail(null)
        setRejecting(false)
        setReason("")
        setFilmRejecting(false)
        setFilmReason("")
        setFilmDecision(null)
        setShowFilmReview(false)
      }
    }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-4xl" showCloseButton={!loading && !filmLoading}>
        <DialogHeader className="border-b bg-gradient-to-r from-slate-50 to-white px-5 py-4 dark:from-slate-950 dark:to-background">
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <ShieldCheckIcon className="h-5 w-5" />
            </span>
            <span>Validar pagos · {sale?.number}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {filmRequiresReview && showFilmReview ? "Revisa el comprobante adicional del film protector." : "Revisa el pago principal y el estado del film de forma independiente."}
          </p>
          {hasFilmEvidence ? (
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2" aria-label="Progreso de validación">
              <div className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
                filmRequiresReview
                  ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-500/10 dark:text-violet-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
              )}>
                {filmRequiresReview ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] text-white">1</span> : <CheckCircleIcon className="h-5 w-5" />}
                <span>Pago del film</span>
              </div>
              <div className={cn("h-px w-5", filmRequiresReview ? "bg-border" : "bg-emerald-400")} />
              <div className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
                filmRequiresReview
                  ? "border-border bg-muted/30 text-muted-foreground"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200",
              )}>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px]", filmRequiresReview ? "bg-muted text-muted-foreground" : "bg-emerald-600 text-white")}>2</span>
                <span>Pago principal</span>
              </div>
            </div>
          ) : null}
        </DialogHeader>

        {filmRequiresReview && showFilmReview ? (
          <div className="grid min-h-[500px] md:grid-cols-[1.15fr_.85fr]">
            <div className="flex min-h-80 items-center justify-center bg-violet-50/60 p-5 dark:bg-violet-950/10">
              {filmMediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={filmMediaUrl} alt="Comprobante del film protector" className="max-h-[62dvh] max-w-full rounded-xl object-contain shadow-sm" />
              ) : <div className="h-64 w-52 animate-pulse rounded-xl bg-violet-100 dark:bg-violet-900/30" />}
            </div>
            <div className="flex flex-col border-t p-5 md:border-l md:border-t-0">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  <ShieldCheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold">Film protector</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pago adicional independiente de la venta.</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-500/10">
                <p className="text-xs font-medium text-violet-700 dark:text-violet-300">Monto esperado</p>
                <p className="mt-1 text-3xl font-black text-violet-900 dark:text-violet-100">{money(sale?.filmAmount || 2)}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Info label="Monto detectado" value={money(sale?.filmEvidence?.detectedAmount)} />
                <Info label="Estado" value={sale?.filmStatus || "Pendiente"} />
                <Info label="Código de operación" value={sale?.filmEvidence?.operationCode || "-"} />
                <Info label="Fecha de operación" value={dateTime(sale?.filmEvidence?.operationAt)} />
              </div>

              {sale?.deliveryMethod === "SHALOM" ? (
                <div className="mt-4 rounded-xl border bg-muted/25 p-3 text-sm">
                  <p className="font-semibold">Envío por Shalom</p>
                  <p className="mt-1 text-xs text-muted-foreground">{sale.shalomAgency || "Agencia no disponible"}</p>
                  {sale.shalomAgencyAddress ? <p className="mt-1 text-xs text-muted-foreground">{sale.shalomAgencyAddress}</p> : null}
                </div>
              ) : null}

              {filmRejecting ? (
                <div className="mt-4 space-y-2">
                  <label className="text-sm font-semibold" htmlFor="film-reject-reason">Motivo para retirar el film</label>
                  <textarea
                    id="film-reject-reason"
                    value={filmReason}
                    onChange={(event) => setFilmReason(event.target.value.slice(0, 500))}
                    className="min-h-24 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-red-500/30"
                    placeholder="Ejemplo: el abono adicional no corresponde"
                  />
                  <p className="text-xs text-amber-700 dark:text-amber-300">Solo se retirará el film. La venta y el pago principal permanecerán intactos.</p>
                </div>
              ) : null}

              <div className="mt-auto flex flex-wrap justify-end gap-2 border-t pt-5">
                {filmRejecting ? (
                  <>
                    <Button variant="outline" disabled={filmLoading} onClick={() => setFilmRejecting(false)}>Volver</Button>
                    <Button variant="destructive" disabled={filmLoading} onClick={() => void decideFilm("REJECT")}>
                      {filmLoading ? "Procesando..." : "Retirar film"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" disabled={filmLoading} onClick={() => setFilmRejecting(true)}>Rechazar solo film</Button>
                    <Button className="bg-violet-600 hover:bg-violet-700" disabled={filmLoading} onClick={() => void decideFilm("ACCEPT")}>
                      {filmLoading ? "Procesando..." : "Aceptar pago del film"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="grid min-h-[460px] md:grid-cols-[1.25fr_.75fr]">
          <div className="flex min-h-80 items-center justify-center bg-slate-100 p-4 dark:bg-black/30">
            {mediaUrl ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl} alt="Comprobante de pago" className="max-h-[62dvh] max-w-full object-contain" />
            </>
              : <div className="h-64 w-52 animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />}
          </div>
          <div className="space-y-4 border-t p-5 md:border-l md:border-t-0">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-500/10">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <BanknotesIcon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Total de la venta</p>
                <p className="mt-0.5 text-2xl font-black text-emerald-950 dark:text-emerald-100">{money(sale?.total)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info label="Monto detectado" value={money(detail?.amount ?? sale?.detectedAmount)} />
              <Info label="Método" value={detail?.provider || sale?.detectedProvider || sale?.paymentMethod || "-"} />
              <Info label="Código de operación" value={detail?.operationCode || sale?.operationCode || "-"} />
              <Info label="Fecha de operación" value={dateTime(detail?.operationAt || sale?.operationAt)} />
            </div>
            <div className="rounded-xl border p-3 text-sm">
              <p className="font-semibold">Pedido</p>
              <div className="mt-2 space-y-2 text-muted-foreground">
                {sale?.items.map((item, index) => (
                  <div className="flex justify-between gap-3" key={`${item.description}-${index}`}>
                    <span>{item.quantity} × {item.description}</span><span>{money(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
            {sale?.cancellationReason ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{sale.cancellationReason}</div> : null}
            {rejecting ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold" htmlFor="reject-reason">Motivo del rechazo</label>
                <textarea id="reject-reason" value={reason} onChange={(event) => setReason(event.target.value.slice(0, 500))}
                  className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-red-500/30"
                  placeholder="Ejemplo: el código de operación no corresponde al abono" />
                <p className="text-xs text-red-600">Al rechazar se anulará la venta completa y se devolverá el stock.</p>
              </div>
            ) : null}
          </div>
        </div>
        {sale?.deliveryMethod === "SHALOM" ? (
          <div className="grid gap-3 border-t bg-muted/20 p-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrega</p>
              <p className="mt-1 font-semibold">Envío por Shalom</p>
              <p className="mt-1 text-xs text-muted-foreground">{sale.shalomAgency || "Agencia no disponible"}</p>
              {sale.shalomAgencyAddress ? <p className="mt-1 text-xs text-muted-foreground">{sale.shalomAgencyAddress}</p> : null}
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Film protector</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="font-semibold">{money(sale.filmAmount || 2)}</p>
                <span className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-bold",
                  filmDecision === "REJECT" || sale.filmStatus === "REJECTED_WITHOUT_FILM"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                )}>
                  {filmDecision === "ACCEPT" ? "Pago aceptado" : filmDecision === "REJECT" ? "Retirado" : filmLabel(sale.filmStatus)}
                </span>
              </div>
              {sale.coveredBySaleId ? <p className="mt-2 text-xs text-muted-foreground">Cubierto por pedido #{sale.coveredBySaleId}</p> : null}
              {filmRequiresReview ? (
                <Button className="mt-3 w-full" variant="outline" onClick={() => setShowFilmReview(true)}>
                  Revisar comprobante del film
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 border-t p-4">
          {canReview ? rejecting ? <>
            <Button variant="outline" disabled={loading} onClick={() => setRejecting(false)}>Volver</Button>
            <Button variant="destructive" disabled={loading} onClick={() => void decide("REJECT")}>{loading ? "Anulando..." : "Confirmar rechazo"}</Button>
          </> : <>
            <Button variant="destructive" disabled={loading} onClick={() => setRejecting(true)}>Rechazar y anular</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={loading} onClick={() => void decide("ACCEPT")}>{loading ? "Procesando..." : "Aceptar pago principal"}</Button>
          </> : <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>}
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-semibold">{value}</p></div>
}

export default function CrmSalesPage() {
  const [data, setData] = useState<SalesPage>({ content: [], totalElements: 0, page: 0, size: 20, totalPages: 0 })
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [filter, setFilter] = useState<ReviewFilter>("ALL")
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CrmSale | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(0) }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: debouncedQuery, reviewStatus: filter, page: String(page), size: "20" })
      const response = await authFetch(`/api/crm/whatsapp/sales?${params}`, { cache: "no-store" })
      if (!response.ok) throw new Error("No se pudieron cargar las ventas del CRM")
      setData(await response.json() as SalesPage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar las ventas")
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, filter, page])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const statusClass = (sale: CrmSale) => cn(
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
    sale.reviewStatus === "PENDING" && "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    sale.reviewStatus === "ACCEPTED" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    sale.reviewStatus === "REJECTED" && "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    (sale.reviewStatus === "PROCESSING" || sale.reviewStatus === "NO_EVIDENCE")
      && "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  )

  const sourceClass = (sale: CrmSale) => cn(
    "mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ring-1",
    sale.source === "IA_KIMENTS"
      ? "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30"
      : "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
  )

  return (
    <main className="min-h-full bg-slate-50/70 p-2 dark:bg-transparent sm:p-3">
      <div className="w-full space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nota, cliente, celular u operación"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => { setFilter(item.value); setPage(0) }}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                  filter === item.value
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                )}
              >
                {item.label}
              </button>
            ))}
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void load()} disabled={loading}>
              <ArrowPathIcon className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>

        <section className="space-y-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80 sm:p-3">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3 text-left">N.º pedido</th>
                  <th className="px-3 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left">Comprobante</th>
                  <th className="px-3 py-3 text-left">Cliente</th>
                  <th className="px-3 py-3 text-left">Sucursal</th>
                  <th className="px-3 py-3 text-left">Entrega</th>
                  <th className="px-3 py-3 text-center">Items</th>
                  <th className="px-3 py-3 text-left">Pago</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-center">Estado</th>
                  <th className="px-3 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="px-3 py-14 text-center"><LoaderSpinner text="Cargando ventas..." /></td></tr>
                ) : data.content.length === 0 ? (
                  <tr><td colSpan={11} className="px-3 py-14 text-center text-sm text-muted-foreground">Sin ventas para los filtros seleccionados</td></tr>
                ) : data.content.map((sale) => (
                  <tr key={sale.saleId} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-3 font-semibold">#{sale.saleId}</td>
                    <td className="px-3 py-3 font-medium">{dateTime(sale.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">{sale.receiptType}</span>
                        <span className="text-xs text-muted-foreground">{sale.number}</span>
                        <span className={sourceClass(sale)}>{sale.source === "IA_KIMENTS" ? "IA Kiments" : "CRM"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{sale.customerName || "Cliente WhatsApp"}</span>
                        <span className="text-[11px] text-muted-foreground">{sale.customerPhone || sale.whatsappPhone || "-"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium">{sale.branch || "Sin sucursal"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                      <span className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        sale.deliveryMethod === "PICKUP" && "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
                        sale.deliveryMethod === "SHALOM" && "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
                        !sale.deliveryMethod && "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                      )}>
                        {sale.deliveryMethod === "PICKUP" ? <BuildingStorefrontIcon className="mr-1 h-4 w-4" /> : null}
                        {sale.deliveryMethod === "SHALOM" ? (
                          <Image src="/img/shalom-delivery.png" alt="Shalom" width={16} height={16} className="mr-1 h-4 w-4 rounded-sm object-cover" />
                        ) : null}
                        {deliveryLabel(sale.deliveryMethod)}
                      </span>
                      {sale.deliveryMethod === "SHALOM" && sale.filmAddonId ? (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          ["CONFIRMED", "COVERED_BY_PREVIOUS_ORDER"].includes(sale.filmStatus || "")
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300")}>Film: {filmLabel(sale.filmStatus)}</span>
                      ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold">{sale.items.length}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{sale.paymentMethod || sale.detectedProvider || "-"}</span>
                        <span className="text-[11px] text-muted-foreground">{sale.operationCode || "Sin código"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">{money(sale.total)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={statusClass(sale)}>
                        {sale.reviewStatus === "ACCEPTED" ? <CheckCircleIcon className="h-4 w-4" /> : null}
                        {sale.reviewStatus === "REJECTED" ? <NoSymbolIcon className="h-4 w-4" /> : null}
                        {reviewLabel(sale.reviewStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Button size="sm" variant={sale.reviewStatus === "PENDING" ? "default" : "outline"} disabled={!sale.evidenceId && !sale.filmAddonId} onClick={() => setSelected(sale)}>
                        {sale.reviewStatus === "PENDING" ? "Validar pago" : "Ver detalle"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-700 lg:hidden">
            {loading ? (
              <div className="p-8">
                <LoaderSpinner text="Cargando ventas..." />
              </div>
            ) : data.content.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Sin ventas para los filtros seleccionados
              </div>
            ) : data.content.map((sale) => (
              <article key={sale.saleId} className="px-3 py-3 transition-colors active:bg-slate-50 dark:active:bg-slate-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">#{sale.saleId}</p>
                      <span className={sourceClass(sale)}>{sale.source === "IA_KIMENTS" ? "IA" : "CRM"}</span>
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                      {sale.customerName || "Cliente WhatsApp"}
                      <span className="font-normal text-slate-400"> · {sale.items.length} {sale.items.length === 1 ? "artículo" : "artículos"}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{money(sale.total)}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{dateTime(sale.createdAt)}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={cn(statusClass(sale), "px-2 py-0.5 text-[10px]")}>
                    {sale.reviewStatus === "ACCEPTED" ? <CheckCircleIcon className="h-3 w-3" /> : null}
                    {sale.reviewStatus === "REJECTED" ? <NoSymbolIcon className="h-3 w-3" /> : null}
                    {reviewLabel(sale.reviewStatus)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {sale.paymentMethod || sale.detectedProvider || "Sin método"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                    {sale.deliveryMethod === "PICKUP" ? <BuildingStorefrontIcon className="h-3 w-3" /> : null}
                    {sale.deliveryMethod === "SHALOM" ? (
                      <Image src="/img/shalom-delivery.png" alt="Shalom" width={12} height={12} className="h-3 w-3 rounded-sm object-cover" />
                    ) : null}
                    {deliveryLabel(sale.deliveryMethod)}
                  </span>
                  {sale.deliveryMethod === "SHALOM" && sale.filmAddonId ? (
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Film: {filmLabel(sale.filmStatus)}</span>
                  ) : null}
                </div>

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="min-w-0 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                    <p className="truncate">{sale.branch || "Sin sucursal"}</p>
                    <p className="truncate">{sale.receiptType} · {sale.number}</p>
                  </div>
                  <Button
                    className="h-8 shrink-0 rounded-lg px-3 text-xs"
                    size="sm"
                    variant={sale.reviewStatus === "PENDING" ? "default" : "outline"}
                    disabled={!sale.evidenceId && !sale.filmAddonId}
                    onClick={() => setSelected(sale)}
                  >
                    {sale.reviewStatus === "PENDING" ? "Validar" : "Detalle"}
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 pb-3 pt-3 dark:border-slate-700/60 sm:px-0 sm:pb-0">
            <p className="text-xs text-muted-foreground">
              {data.totalElements} ventas{data.totalPages > 0 && ` · Página ${data.page + 1} de ${data.totalPages}`}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <ChevronLeftIcon className="h-4 w-4" /> Anterior
              </button>
              <button type="button" disabled={page + 1 >= data.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Siguiente <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
      <ReviewDialog sale={selected} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }} onUpdated={() => void load()} />
    </main>
  )
}
