"use client"

import {
  ArrowPathIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"

import { Button } from "@/components/ui/button"

export interface AiFeedbackResponse {
  decision: "APPROVED" | "EDITED" | "DISCARDED"
  finalText: string | null
  similarityPercentage: number | null
  changedCharacters: number | null
  discardReason: string | null
  sendStatus: string
  reviewerId: number
  reviewedAt: string
  outgoingMessageId: number | null
}

export interface AiRunResponse {
  idRun: number
  idMessage: number
  idJob: number
  jobStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "SKIPPED" | "SUPERSEDED" | "FAILED"
  outcome: "DRAFT_READY" | "HUMAN_REQUIRED" | "SKIPPED" | "FAILED"
  intent: string | null
  confidence: number | null
  requiresHuman: boolean
  reason: string | null
  draft: string | null
  evidence: Array<Record<string, unknown>>
  suggestedMedia: Array<{
    type?: "PRODUCT_IMAGE" | "SIZE_GUIDE"
    productId?: number
    variantId?: number
    product?: string
    color?: string
    url?: string
    thumbnailUrl?: string
  }>
  feedback: AiFeedbackResponse | null
  createdAt: string
}

export interface AiRunsResponse {
  mode: "DESACTIVADA" | "SUGERENCIAS" | "AUTOMATICA"
  canGenerate: boolean
  content: AiRunResponse[]
}

interface AiCopilotCardProps {
  run: AiRunResponse | null
  draft: string
  processing: boolean
  submitting: boolean
  error: string
  onDraftChange: (value: string) => void
  onSend: () => void
  onRegenerate: () => void
  onDiscard: () => void
  onTakeOver?: () => void
  onClose: () => void
}

const TOOL_LABELS: Record<string, string> = {
  buscar_productos: "Productos consultados",
  consultar_sucursal: "Sucursal vinculada",
  consultar_metodos_pago: "Métodos de pago",
  consultar_cliente_actual: "Cliente actual",
  consultar_ventas_cliente: "Ventas del cliente",
}

function asRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : []
}

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value)
  return Number.isFinite(amount) ? `S/${amount.toFixed(2)}` : ""
}

export function AiCopilotCard({
  run,
  draft,
  processing,
  submitting,
  error,
  onDraftChange,
  onSend,
  onRegenerate,
  onDiscard,
  onTakeOver,
  onClose,
}: AiCopilotCardProps) {
  if (!processing && !run && !error) return null
  if (!processing && run?.outcome !== "FAILED" && (run?.requiresHuman || run?.outcome === "HUMAN_REQUIRED")) return null

  const productEvidence = run?.evidence
    .filter((item) => item.tool === "buscar_productos")
    .flatMap((item) => asRecords(item.products)) ?? []
  const sourceLabels = Array.from(new Set(
    (run?.evidence ?? [])
      .map((item) => TOOL_LABELS[String(item.tool ?? "")])
      .filter(Boolean),
  ))
  const canSend = Boolean(run?.outcome === "DRAFT_READY" && draft.trim()) && !submitting
  const requiresHuman = Boolean(
    run?.requiresHuman || run?.outcome === "HUMAN_REQUIRED" || run?.outcome === "FAILED",
  )

  return (
    <section className={`relative z-10 mb-2 max-h-[46vh] overflow-y-auto rounded-lg border bg-background p-3 shadow-lg ${requiresHuman ? "border-amber-300 dark:border-amber-800" : "border-blue-200 dark:border-blue-900"}`}>
      <div className="flex items-start gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${requiresHuman ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"}`}>
          {requiresHuman ? <ExclamationTriangleIcon className="h-4 w-4" /> : <SparklesIcon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-foreground">{requiresHuman ? "Atencion requerida" : "IA Kiments"}</p>
            {run?.intent && (
              <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {run.intent.replaceAll("_", " ")}
              </span>
            )}
            {run?.confidence != null && (
              <span className="text-[10px] tabular-nums text-muted-foreground">{run.confidence}%</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {processing
              ? "Preparando una respuesta con datos del negocio..."
              : requiresHuman
                ? "IA Kiments detuvo la atencion automatica para que responda un asesor."
                : "Revisa la respuesta antes de enviarla."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cerrar copiloto"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {processing ? (
        <div className="mt-3 space-y-2" aria-label="Generando respuesta">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-[88%] animate-pulse rounded bg-muted" />
          <div className="h-3 w-[64%] animate-pulse rounded bg-muted" />
        </div>
      ) : error ? (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : run?.outcome === "FAILED" ? (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {run.reason || "No se pudo generar la respuesta. Intenta nuevamente."}
        </div>
      ) : run?.requiresHuman || run?.outcome === "HUMAN_REQUIRED" ? (
        <div className="mt-3 space-y-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          {run.reason || "Esta consulta necesita la revisión directa de un asesor."}
          {onTakeOver && (
            <Button type="button" size="sm" className="h-8 bg-amber-600 text-white hover:bg-amber-700" disabled={submitting} onClick={onTakeOver}>
              <UserIcon className="h-4 w-4" />
              Atender chat
            </Button>
          )}
        </div>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.currentTarget.value)}
            rows={4}
            maxLength={4000}
            className="mt-3 min-h-24 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-5 text-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            aria-label="Borrador de respuesta de IA Kiments"
          />

          {(sourceLabels.length > 0 || productEvidence.length > 0) && (
            <div className="mt-3 border-t border-border pt-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Datos utilizados</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {sourceLabels.map((label) => (
                  <span key={label} className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                    <CheckIcon className="mr-1 inline h-3 w-3 text-emerald-500" />{label}
                  </span>
                ))}
              </div>
              {productEvidence.slice(0, 3).map((product, index) => {
                const variants = asRecords(product.variants)
                const variant = variants[0]
                return (
                  <div key={String(product.productId ?? index)} className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate font-medium text-foreground">{String(product.name ?? "Producto")}</span>
                    {variant && (
                      <span className="shrink-0 text-muted-foreground">
                        {String(variant.color ?? "")} {String(variant.size ?? "")} · Stock {String(variant.stock ?? 0)} · {money(variant.currentPrice)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {Boolean(run?.suggestedMedia.length) && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {run?.suggestedMedia.slice(0, 3).map((media, index) => (
                <div key={`${media.variantId ?? index}-${media.url ?? index}`} className="w-20 shrink-0">
                  <div
                    className="aspect-square rounded-md border border-border bg-muted bg-cover bg-center"
                    style={{ backgroundImage: media.thumbnailUrl || media.url ? `url("${media.thumbnailUrl || media.url}")` : undefined }}
                    role="img"
                    aria-label={media.product || "Producto sugerido"}
                  />
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    {media.type === "SIZE_GUIDE" ? "Guía de tallas" : media.product || "Producto"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!processing && run?.outcome === "DRAFT_READY" && !error && (
        <div className="mt-3 grid grid-cols-[auto_auto_1fr] gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 px-2" disabled={submitting} onClick={onDiscard}>
            <TrashIcon className="h-4 w-4" />
            <span className="sr-only">Descartar borrador</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 px-2" disabled={submitting} onClick={onRegenerate}>
            <ArrowPathIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Regenerar</span>
          </Button>
          <Button type="button" size="sm" className="h-8 bg-blue-600 text-white hover:bg-blue-700" disabled={!canSend} onClick={onSend}>
            <PaperAirplaneIcon className="h-4 w-4" />
            {submitting ? "Enviando..." : "Enviar respuesta"}
          </Button>
        </div>
      )}

      {!processing && run?.outcome === "FAILED" && !error && (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" className="h-8" disabled={submitting} onClick={onRegenerate}>
            <ArrowPathIcon className="h-4 w-4" />
            Reintentar con IA Kiments
          </Button>
        </div>
      )}
    </section>
  )
}
