"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowPathIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  FunnelIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PhotoIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoaderSpinner } from "@/components/ui/loader-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { authFetch } from "@/lib/auth/auth-fetch"
import { useAuth } from "@/lib/auth/auth-context"
import { isCrmAdmin, isWarehouseUser } from "@/lib/auth/roles"
import { cn } from "@/lib/utils"

type ReviewFilter = "ALL" | "PENDING" | "ACCEPTED" | "REJECTED"

interface SaleItem {
  description: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
  imageUrl?: string | null
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
  source: "CRM" | "IA_KIMENTS" | "POS" | "WEB" | "ECOMMERCE" | string
  createdByUserId: number | null
  createdByName: string | null
  shippingConversationId: number | null
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

function money(value: number | null | undefined) {
  return `S/ ${Number(value ?? 0).toFixed(2)}`
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "-"
}

function localDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-muted/45 px-3 py-2.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 break-words text-sm font-semibold">{value}</p></div>
}

function SaleDetailContent({ sale }: {
  sale: CrmSale
}) {
  return (
    <div className="space-y-4 px-4 pb-5">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <DetailValue label="Pedido" value={`#${sale.saleId}`} />
        <DetailValue label="Fecha" value={dateTime(sale.createdAt)} />
        <DetailValue label="Cliente" value={sale.customerName || "Cliente WhatsApp"} />
        <DetailValue label="Celular" value={sale.customerPhone || sale.whatsappPhone || "-"} />
        <DetailValue label="Origen" value={sale.source === "IA_KIMENTS" ? "IA Kiments" : sale.source} />
        <DetailValue label="Creado por" value={sale.createdByName || "-"} />
      </div>

      {sale.deliveryMethod ? (
        <div className={cn(
          "flex items-start gap-3 rounded-2xl border p-4",
          sale.deliveryMethod === "SHALOM"
            ? "border-orange-200 bg-orange-50/70 dark:border-orange-500/25 dark:bg-orange-500/10"
            : "border-sky-200 bg-sky-50/70 dark:border-sky-500/25 dark:bg-sky-500/10",
        )}>
          <span className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/10",
            sale.deliveryMethod === "SHALOM" ? "text-orange-700" : "text-sky-700",
          )}>
            {sale.deliveryMethod === "SHALOM" ? (
              <Image src="/img/shalom-delivery.png" alt="Shalom" width={28} height={28} className="h-7 w-7 rounded-md object-cover" />
            ) : (
              <BuildingStorefrontIcon className="h-6 w-6" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Modo de entrega</p>
            <p className="mt-0.5 font-bold">{deliveryLabel(sale.deliveryMethod)}</p>
            {sale.deliveryMethod === "SHALOM" && sale.shalomAgency ? (
              <p className="mt-1 text-sm text-muted-foreground">Agencia: {sale.shalomAgency}</p>
            ) : null}
            {sale.deliveryMethod === "SHALOM" && sale.shalomAgencyAddress ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{sale.shalomAgencyAddress}</p>
            ) : null}
            {sale.deliveryMethod === "PICKUP" && sale.branch ? (
              <p className="mt-1 text-sm text-muted-foreground">Sucursal: {sale.branch}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-muted/30">
        <div className="px-3 pb-1 pt-3 text-sm font-semibold">Productos</div>
        <div className="divide-y divide-border/50">
          {sale.items.map((item, index) => (
            <div key={`${item.description}-${index}`} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-3 py-3 text-sm">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.description || "Producto"} className="h-14 w-14 rounded-xl bg-background object-cover" />
              ) : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-background text-muted-foreground"><PhotoIcon className="h-6 w-6" /></span>}
              <div className="min-w-0">
                <p className="font-medium">{item.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.quantity} × {money(item.unitPrice)}{item.discount ? ` · Descuento ${money(item.discount)}` : ""}</p>
              </div>
              <p className="font-bold tabular-nums">{money(item.total)}</p>
            </div>
          ))}
        </div>
      </div>

      {sale.cancellationReason ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{sale.cancellationReason}</div> : null}

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Total de la venta</span>
        <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200">{money(sale.total)}</span>
      </div>
    </div>
  )
}

function SaleDetail({ sale, open, onOpenChange, canChat, openingChat, onChat }: {
  sale: CrmSale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canChat: boolean
  openingChat: boolean
  onChat: () => void
}) {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)")
    const update = () => setDesktop(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  if (!sale) return null

  const header = (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><EyeIcon className="h-5 w-5" /></span>
      <div><p className="font-bold">Detalle de la venta</p><p className="text-xs text-muted-foreground">Pedido #{sale.saleId}</p></div>
    </div>
  )
  const chatAction = canChat ? (
    <div className="shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur">
      <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={!(sale.whatsappPhone || sale.customerPhone) || openingChat} onClick={onChat}>
        <ChatBubbleLeftRightIcon className="h-5 w-5" />
        {openingChat ? "Abriendo chat..." : "Chatear con el cliente"}
      </Button>
    </div>
  ) : null

  if (desktop) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4"><DialogTitle asChild>{header}</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4"><SaleDetailContent sale={sale} /></div>
        {chatAction}
      </DialogContent>
    </Dialog>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl p-0 pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="shrink-0 border-b border-border/60 bg-background px-4 py-4 pr-12"><SheetTitle asChild>{header}</SheetTitle></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4"><SaleDetailContent sale={sale} /></div>
        {chatAction}
      </SheetContent>
    </Sheet>
  )
}

function SearchSale({ open, onOpenChange, onFound }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFound: (sale: CrmSale) => void
}) {
  const [desktop, setDesktop] = useState(false)
  const [saleId, setSaleId] = useState("")
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)")
    const update = () => setDesktop(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  const changeOpen = (next: boolean) => {
    if (searching) return
    onOpenChange(next)
    if (!next) {
      setSaleId("")
      setError("")
    }
  }

  const search = async () => {
    const normalizedId = saleId.trim()
    if (!/^\d+$/.test(normalizedId)) {
      setError("Ingresa un número de pedido válido")
      return
    }
    setSearching(true)
    setError("")
    try {
      const params = new URLSearchParams({
        q: normalizedId,
        reviewStatus: "ALL",
        receiptType: "ALL",
        saleStatus: "ALL",
        period: "ALL",
        source: "ALL",
        page: "0",
        size: "20",
      })
      const response = await authFetch(`/api/crm/whatsapp/sales?${params}`, { cache: "no-store" })
      if (!response.ok) throw new Error("No se pudo buscar el pedido")
      const result = await response.json() as SalesPage
      const sale = result.content.find((item) => item.saleId === Number(normalizedId))
      if (!sale) {
        setError(`No se encontró el pedido #${normalizedId}`)
        return
      }
      onOpenChange(false)
      setSaleId("")
      onFound(sale)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "No se pudo buscar el pedido")
    } finally {
      setSearching(false)
    }
  }

  const form = (
    <form className="space-y-4 px-5 pb-5" onSubmit={(event) => { event.preventDefault(); void search() }}>
      <div className="space-y-2">
        <Label htmlFor="search-sale-id" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Número de pedido</Label>
        <div className="relative">
          <HashtagIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input id="search-sale-id" inputMode="numeric" pattern="[0-9]*" autoComplete="off" autoFocus={desktop} value={saleId} onChange={(event) => { setSaleId(event.target.value.replace(/\D/g, "")); setError("") }} placeholder="Ejemplo: 8645" className="h-14 rounded-xl pl-11 text-center text-xl font-bold tracking-widest" />
        </div>
        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={searching}>Cancelar</Button>
        <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={searching || !saleId}>
          {searching ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <MagnifyingGlassIcon className="h-4 w-4" />}
          {searching ? "Buscando..." : "Buscar pedido"}
        </Button>
      </div>
    </form>
  )

  const heading = <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white"><MagnifyingGlassIcon className="h-5 w-5" /></span><span>Buscar pedido</span></div>

  if (desktop) return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="p-0 sm:max-w-md">
        <DialogHeader className="px-5 pb-3 pt-5"><DialogTitle asChild>{heading}</DialogTitle></DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  )

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="px-5 pb-3 pt-5 pr-12"><SheetTitle asChild>{heading}</SheetTitle></SheetHeader>
        {form}
      </SheetContent>
    </Sheet>
  )
}

export default function CrmSalesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = isCrmAdmin(user?.rol)
  const isWarehouse = isWarehouseUser(user?.rol)
  const canChat = isAdmin || isWarehouse
  const showActions = true
  const [data, setData] = useState<SalesPage>({ content: [], totalElements: 0, page: 0, size: 20, totalPages: 0 })
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [filter] = useState<ReviewFilter>("ALL")
  const [receiptType, setReceiptType] = useState("ALL")
  const [saleStatus, setSaleStatus] = useState("ALL")
  const [period, setPeriod] = useState("TODAY")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [quickDateSelected, setQuickDateSelected] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [source, setSource] = useState("ALL")
  const [order, setOrder] = useState<"DESC" | "ASC">("DESC")
  const [openingChatId, setOpeningChatId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selected, setSelected] = useState<CrmSale | null>(null)
  const [detailSale, setDetailSale] = useState<CrmSale | null>(null)
  const [searchSaleOpen, setSearchSaleOpen] = useState(false)
  const daysScrollerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const upcomingDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 30 }, (_, index) => {
      const daysAgo = 29 - index
      const date = new Date(today)
      date.setDate(today.getDate() - daysAgo)
      return {
        value: localDateValue(date),
        dayNumber: date.getDate(),
        weekday: new Intl.DateTimeFormat("es-PE", { weekday: "short" }).format(date).replace(".", ""),
        month: new Intl.DateTimeFormat("es-PE", { month: "short" }).format(date).replace(".", ""),
        relativeLabel: daysAgo === 0 ? "Hoy" : daysAgo === 1 ? "Ayer" : null,
      }
    })
  }, [])

  useEffect(() => {
    const scroller = daysScrollerRef.current
    if (!scroller) return
    scroller.scrollLeft = scroller.scrollWidth
  }, [upcomingDays])

  const selectDay = (date: string) => {
    setQuickDateSelected(true)
    setPeriod("CUSTOM")
    setFromDate(date)
    setToDate(date)
    setPage(0)
  }

  const scrollDays = (direction: -1 | 1) => {
    daysScrollerRef.current?.scrollBy({
      left: direction * Math.max(daysScrollerRef.current.clientWidth * 0.8, 320),
      behavior: "smooth",
    })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(0) }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const load = useCallback(async () => {
    const appendOnMobile = page > 0 && window.innerWidth < 1024
    if (appendOnMobile) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ q: debouncedQuery, reviewStatus: filter, receiptType, saleStatus, period, source, order, page: String(page), size: "20" })
      if (fromDate) params.set("from", fromDate)
      if (toDate) params.set("to", toDate)
      const response = await authFetch(`/api/crm/whatsapp/sales?${params}`, { cache: "no-store" })
      if (!response.ok) throw new Error("No se pudieron cargar las ventas del CRM")
      const nextData = await response.json() as SalesPage
      setData((current) => appendOnMobile
        ? {
            ...nextData,
            content: [
              ...current.content,
              ...nextData.content.filter((nextSale) => !current.content.some((sale) => sale.saleId === nextSale.saleId)),
            ],
          }
        : nextData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar las ventas")
    } finally {
      if (appendOnMobile) setLoadingMore(false)
      else setLoading(false)
    }
  }, [debouncedQuery, filter, receiptType, saleStatus, period, source, order, fromDate, toDate, page])

  const openShippingChat = async (sale: CrmSale) => {
    const contactPhone = sale.whatsappPhone || sale.customerPhone
    if (!contactPhone || openingChatId !== null) return
    setOpeningChatId(sale.saleId)
    try {
      let conversationId = sale.shippingConversationId
      if (!conversationId) {
        const response = await authFetch(`/api/crm/warehouse/orders/${sale.saleId}/shipping-conversation`, { method: "POST" })
        const payload = await response.json().catch(() => null) as { conversationId?: number; message?: string } | null
        if (!response.ok || !payload?.conversationId) throw new Error(payload?.message || "No se pudo abrir el chat de Envíos")
        conversationId = payload.conversationId
      }
      router.push(`/chat?area=shipping&conversationId=${conversationId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el chat de Envíos")
    } finally {
      setOpeningChatId(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || loading || loadingMore || page + 1 >= data.totalPages) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && window.innerWidth < 1024) {
        setLoadingMore(true)
        setPage((current) => current + 1)
      }
    }, { rootMargin: "200px 0px" })

    observer.observe(target)
    return () => observer.disconnect()
  }, [data.totalPages, loading, loadingMore, page])
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
    <main className="min-h-full bg-background sm:bg-slate-50/70 sm:p-3 dark:sm:bg-transparent">
      <div className="w-full sm:space-y-3">
        <section className="border-b border-border bg-background px-3 pb-3 pt-2 sm:rounded-2xl sm:border sm:border-slate-100 sm:p-4 sm:shadow-sm dark:sm:border-slate-700/60 dark:sm:bg-slate-800/80">
          {canChat ? <div className="mb-3 hidden justify-end sm:flex">
            <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setSearchSaleOpen(true)}>
              <MagnifyingGlassIcon className="h-4 w-4" />
              Buscar pedido
            </Button>
          </div> : null}
          <div className="mb-3 flex items-center gap-2 sm:hidden">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sales-search-mobile"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar comprobante"
                className="h-10 pl-9"
              />
            </div>
            {canChat ? <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 border-blue-200 text-blue-700" onClick={() => setSearchSaleOpen(true)} aria-label="Buscar pedido" title="Buscar pedido">
              <HashtagIcon className="h-4 w-4" />
            </Button> : null}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setFiltersOpen(true)} aria-label="Abrir filtros de ventas">
                <FunnelIcon className="h-4 w-4" />
              </Button>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
                <SheetHeader className="mb-4 pr-8">
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={receiptType} onValueChange={(value) => { setReceiptType(value); setPage(0) }}>
                      <SelectTrigger aria-label="Tipo de comprobante"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="NOTA DE VENTA">Nota de venta</SelectItem>
                        <SelectItem value="BOLETA">Boleta</SelectItem>
                        <SelectItem value="FACTURA">Factura</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Estado</Label>
                    <Select value={saleStatus} onValueChange={(value) => { setSaleStatus(value); setPage(0) }}>
                      <SelectTrigger aria-label="Estado de la venta"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="EMITIDA">Emitida</SelectItem>
                        <SelectItem value="ANULADA">Anulada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Período</Label>
                    <Select value={quickDateSelected ? "QUICK_DATE" : period} onValueChange={(value) => { setQuickDateSelected(false); setPeriod(value); setFromDate(""); setToDate(""); setPage(0) }}>
                      <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {quickDateSelected ? <SelectItem value="QUICK_DATE">Día seleccionado</SelectItem> : null}
                        <SelectItem value="TODAY">Hoy</SelectItem>
                        <SelectItem value="WEEK">Esta semana</SelectItem>
                        <SelectItem value="MONTH">Este mes</SelectItem>
                        <SelectItem value="ALL">Todo</SelectItem>
                        <SelectItem value="CUSTOM">Rango de fechas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {period === "CUSTOM" && !quickDateSelected ? <>
                    <div className="space-y-1.5">
                      <Label htmlFor="sales-from-mobile" className="text-xs text-muted-foreground">Desde</Label>
                      <Input id="sales-from-mobile" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0) }} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sales-to-mobile" className="text-xs text-muted-foreground">Hasta</Label>
                      <Input id="sales-to-mobile" type="date" value={toDate} min={fromDate} onChange={(event) => { setToDate(event.target.value); setPage(0) }} className="h-10" />
                    </div>
                  </> : null}
                  <Button type="button" className="col-span-2 mt-1" onClick={() => setFiltersOpen(false)}>Ver resultados</Button>
                </div>
              </SheetContent>
            </Sheet>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => { if (page === 0) void load(); else setPage(0) }}
              disabled={loading}
              aria-label="Actualizar ventas"
              title="Actualizar ventas"
            >
              <ArrowPathIcon className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="mb-3 grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1 sm:hidden" aria-label="Orden de los pedidos">
            <Button
              type="button"
              size="sm"
              variant={order === "DESC" ? "default" : "ghost"}
              className="rounded-lg"
              aria-pressed={order === "DESC"}
              onClick={() => { setOrder("DESC"); setPage(0) }}
            >
              Últimos pedidos
            </Button>
            <Button
              type="button"
              size="sm"
              variant={order === "ASC" ? "default" : "ghost"}
              className="rounded-lg"
              aria-pressed={order === "ASC"}
              onClick={() => { setOrder("ASC"); setPage(0) }}
            >
              Primeros pedidos
            </Button>
          </div>

          <div className="hidden grid-cols-2 gap-2.5 sm:grid sm:gap-3 xl:grid-cols-12">
            <div className="col-span-2 space-y-1.5 xl:col-span-4">
              <Label htmlFor="sales-search" className="text-xs text-muted-foreground">Comprobante</Label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="sales-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por número de comprobante" className="h-10 pl-9" />
              </div>
            </div>

            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={receiptType} onValueChange={(value) => { setReceiptType(value); setPage(0) }}>
                <SelectTrigger aria-label="Tipo de comprobante"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="NOTA DE VENTA">Nota de venta</SelectItem>
                  <SelectItem value="BOLETA">Boleta</SelectItem>
                  <SelectItem value="FACTURA">Factura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={saleStatus} onValueChange={(value) => { setSaleStatus(value); setPage(0) }}>
                <SelectTrigger aria-label="Estado de la venta"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="EMITIDA">Emitida</SelectItem>
                  <SelectItem value="ANULADA">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-xs text-muted-foreground">Período</Label>
              <Select value={quickDateSelected ? "QUICK_DATE" : period} onValueChange={(value) => { setQuickDateSelected(false); setPeriod(value); setFromDate(""); setToDate(""); setPage(0) }}>
                <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {quickDateSelected ? <SelectItem value="QUICK_DATE">Día seleccionado</SelectItem> : null}
                  <SelectItem value="TODAY">Hoy</SelectItem>
                  <SelectItem value="WEEK">Esta semana</SelectItem>
                  <SelectItem value="MONTH">Este mes</SelectItem>
                  <SelectItem value="ALL">Todo</SelectItem>
                  <SelectItem value="CUSTOM">Rango de fechas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdmin ? <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-xs text-muted-foreground">Origen</Label>
              <Select value={source} onValueChange={(value) => { setSource(value); setPage(0) }}>
                <SelectTrigger aria-label="Origen de la venta"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="IA_KIMENTS">IA Kimets</SelectItem>
                </SelectContent>
              </Select>
            </div> : null}

            {period === "CUSTOM" && !quickDateSelected ? <>
              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="sales-from" className="text-xs text-muted-foreground">Desde</Label>
                <Input id="sales-from" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0) }} className="h-10" />
              </div>
              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="sales-to" className="text-xs text-muted-foreground">Hasta</Label>
                <Input id="sales-to" type="date" value={toDate} min={fromDate} onChange={(event) => { setToDate(event.target.value); setPage(0) }} className="h-10" />
              </div>
            </> : null}
          </div>

          <div className="mt-3 hidden items-center justify-end gap-2 sm:flex">
            <span className="text-xs font-medium text-muted-foreground">Ordenar:</span>
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1" aria-label="Orden de los pedidos">
              <Button
                type="button"
                size="sm"
                variant={order === "DESC" ? "default" : "ghost"}
                className="rounded-lg"
                aria-pressed={order === "DESC"}
                onClick={() => { setOrder("DESC"); setPage(0) }}
              >
                Últimos pedidos
              </Button>
              <Button
                type="button"
                size="sm"
                variant={order === "ASC" ? "default" : "ghost"}
                className="rounded-lg"
                aria-pressed={order === "ASC"}
                onClick={() => { setOrder("ASC"); setPage(0) }}
              >
                Primeros pedidos
              </Button>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" className="hidden shrink-0 rounded-full sm:inline-flex" onClick={() => scrollDays(-1)} aria-label="Ver días anteriores">
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
            <div
              ref={daysScrollerRef}
              className="scrollbar-hide -mx-3 flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-3 pb-1 sm:mx-0 sm:px-0 sm:pb-2 sm:[scrollbar-width:thin]"
              aria-label="Fechas disponibles para filtrar ventas"
            >
              {upcomingDays.map((day) => {
                const active = (period === "TODAY" && day.value === upcomingDays.at(-1)?.value)
                  || (period === "CUSTOM" && fromDate === day.value && toDate === day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => selectDay(day.value)}
                    aria-pressed={active}
                    aria-label={`Filtrar ventas del ${day.value}`}
                    className={cn(
                      "min-w-[64px] snap-start rounded-xl border px-1.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-w-[82px] sm:px-2 xl:min-w-0 xl:basis-[calc((100%-4.5rem)/10)] xl:shrink-0",
                      active
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-500 dark:bg-blue-500"
                        : "border-slate-200 bg-white text-foreground hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-700 dark:hover:bg-blue-950/30",
                    )}
                  >
                    <span className={cn("block truncate text-[10px] font-semibold uppercase", active ? "text-blue-100" : "text-muted-foreground")}>
                      {day.relativeLabel ?? day.weekday}
                    </span>
                    <span className="block text-lg font-bold leading-5">{day.dayNumber}</span>
                    <span className={cn("block text-[10px] uppercase", active ? "text-blue-100" : "text-muted-foreground")}>{day.month}</span>
                  </button>
                )
              })}
            </div>
              <Button type="button" variant="outline" size="icon-sm" className="hidden shrink-0 rounded-full sm:inline-flex" onClick={() => scrollDays(1)} aria-label="Volver a días más recientes">
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

        </section>

        <section className="overflow-hidden bg-background sm:space-y-3 sm:rounded-2xl sm:border sm:border-slate-100 sm:bg-white sm:p-3 sm:shadow-sm dark:sm:border-slate-700/60 dark:sm:bg-slate-800/80">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3 text-left">N.º pedido</th>
                  <th className="px-3 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left">Comprobante</th>
                  <th className="px-3 py-3 text-left">Cliente</th>
                  <th className="px-3 py-3 text-left">Entrega</th>
                  <th className="px-3 py-3 text-center">Items</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-center">Estado</th>
                  {showActions ? <th className="px-3 py-3 text-center">Acción</th> : null}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={showActions ? 9 : 8} className="px-3 py-14 text-center"><LoaderSpinner text="Cargando ventas..." /></td></tr>
                ) : data.content.length === 0 ? (
                  <tr><td colSpan={showActions ? 9 : 8} className="px-3 py-14 text-center text-sm text-muted-foreground">Sin ventas para los filtros seleccionados</td></tr>
                ) : data.content.map((sale) => (
                  <tr key={sale.saleId} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-3 font-semibold">#{sale.saleId}</td>
                    <td className="px-3 py-3 font-medium">{dateTime(sale.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">{sale.receiptType}</span>
                        <span className="text-xs text-muted-foreground">{sale.number}</span>
                        <span className={sourceClass(sale)}>{sale.source === "IA_KIMENTS" ? "IA Kiments" : sale.source}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{sale.customerName || "Cliente WhatsApp"}</span>
                        <span className="text-[11px] text-muted-foreground">{sale.customerPhone || sale.whatsappPhone || "-"}</span>
                      </div>
                    </td>
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
                    <td className="px-3 py-3 text-right font-semibold">{money(sale.total)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={statusClass(sale)}>
                        {sale.reviewStatus === "ACCEPTED" ? <CheckCircleIcon className="h-4 w-4" /> : null}
                        {sale.reviewStatus === "REJECTED" ? <NoSymbolIcon className="h-4 w-4" /> : null}
                        {reviewLabel(sale.reviewStatus)}
                      </span>
                    </td>
                    {showActions ? <td className="px-3 py-3 text-center"><div className="flex justify-center gap-2">
                      <Button size="icon-sm" className="bg-blue-600 text-white shadow-sm hover:bg-blue-700" title="Ver detalle" aria-label="Ver detalle" onClick={() => setDetailSale(sale)}><EyeIcon /></Button>
                      {isAdmin && sale.source === "IA_KIMENTS" && sale.reviewStatus === "PENDING" ? <Button size="icon-sm" className="bg-amber-500 text-white shadow-sm hover:bg-amber-600" title="Validar pago" aria-label="Validar pago" onClick={() => setSelected(sale)}><ShieldCheckIcon /></Button> : null}
                      {canChat ? <Button size="icon-sm" className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" disabled={!(sale.whatsappPhone || sale.customerPhone) || openingChatId === sale.saleId} title={!(sale.whatsappPhone || sale.customerPhone) ? "Sin celular registrado" : "Chatear"} aria-label="Chatear" onClick={() => void openShippingChat(sale)}><ChatBubbleLeftRightIcon className={cn(openingChatId === sale.saleId && "animate-pulse")} /></Button> : null}
                    </div></td> : null}
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
                      <span className={sourceClass(sale)}>{sale.source === "IA_KIMENTS" ? "IA" : sale.source}</span>
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
                  {showActions ? <div className="flex shrink-0 gap-1">
                    <Button size="icon-sm" className="bg-blue-600 text-white shadow-sm hover:bg-blue-700" title="Ver detalle" aria-label="Ver detalle" onClick={() => setDetailSale(sale)}><EyeIcon /></Button>
                    {isAdmin && sale.source === "IA_KIMENTS" && sale.reviewStatus === "PENDING" ? <Button size="icon-sm" className="bg-amber-500 text-white shadow-sm hover:bg-amber-600" title="Validar pago" aria-label="Validar pago" onClick={() => setSelected(sale)}><ShieldCheckIcon /></Button> : null}
                    {canChat ? <Button size="icon-sm" className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" disabled={!(sale.whatsappPhone || sale.customerPhone) || openingChatId === sale.saleId} title={!(sale.whatsappPhone || sale.customerPhone) ? "Sin celular registrado" : "Chatear"} aria-label="Chatear" onClick={() => void openShippingChat(sale)}><ChatBubbleLeftRightIcon className={cn(openingChatId === sale.saleId && "animate-pulse")} /></Button> : null}
                  </div> : null}
                </div>
              </article>
            ))}
            <div ref={loadMoreRef} className="lg:hidden">
              {loadingMore ? <div className="p-5"><LoaderSpinner text="Cargando más ventas..." /></div> : null}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 pb-3 pt-3 dark:border-slate-700/60 sm:px-0 sm:pb-0">
            <p className="text-xs text-muted-foreground">
              {data.totalElements} ventas
            </p>
            <div className="hidden items-center gap-2 lg:flex">
              <button type="button" disabled={page <= 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Página anterior" title="Página anterior">
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="min-w-16 text-center text-xs font-semibold tabular-nums text-foreground">
                {data.totalPages > 0 ? `${data.page + 1} / ${data.totalPages}` : "0 / 0"}
              </span>
              <button type="button" disabled={page + 1 >= data.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Página siguiente" title="Página siguiente">
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
      <SearchSale open={searchSaleOpen} onOpenChange={setSearchSaleOpen} onFound={setDetailSale} />
      <SaleDetail sale={detailSale} open={Boolean(detailSale)} onOpenChange={(open) => { if (!open) setDetailSale(null) }} canChat={canChat} openingChat={openingChatId === detailSale?.saleId} onChat={() => { if (detailSale) void openShippingChat(detailSale) }} />
      <ReviewDialog sale={selected} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }} onUpdated={() => void load()} />
    </main>
  )
}
