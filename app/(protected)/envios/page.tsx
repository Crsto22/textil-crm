"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"

import { ChatAvatar } from "@/components/chat/ChatAvatar"
import { ChatWallpaperLayer } from "@/components/chat/ChatWallpaperLayer"
import { WarehouseChatComposer } from "@/components/chat/WarehouseChatComposer"
import { WarehouseMessageBubble, type WarehouseChatMessage } from "@/components/chat/WarehouseMessageBubble"
import { authFetch } from "@/lib/auth/auth-fetch"
import { cn } from "@/lib/utils"

type WarehouseStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED"

type WarehouseSale = {
  saleId: number
  number: string
  receiptType: string
  createdAt: string
  total: number
  currency: string
  saleStatus: string
  customerName: string
  customerPhone: string
  branch: string
  warehouseStatus: WarehouseStatus
  hasSalesChat: boolean
  hasShippingChat: boolean
  cancelled: boolean
}

type SaleItem = {
  description: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
  imageUrl?: string | null
}

type WarehouseDetail = {
  sale: WarehouseSale
  customerDocument?: string | null
  customerAddress?: string | null
  items: SaleItem[]
  salesConversationId?: number | null
  shippingConversationId?: number | null
  shippingOperational: boolean
  shippingBlockedReason?: string | null
  startedAt?: string | null
  completedAt?: string | null
  updatedAt: string
}

type WarehousePage = {
  content: WarehouseSale[]
  totalElements: number
  page: number
  size: number
  totalPages: number
}

type WarehouseMessagePage = {
  content: WarehouseChatMessage[]
  oldestId?: number | null
  newestId?: number | null
  hasMoreBefore: boolean
}

const ORDER_PAGE_SIZE = 10
const MESSAGE_PAGE_SIZE = 10

const STATUS_LABEL: Record<WarehouseStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completado",
}

const STATUS_STYLE: Record<WarehouseStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
}

const FILTERS: Array<{ value: "ALL" | WarehouseStatus; label: string }> = [
  { value: "PENDING", label: "Pendientes" },
  { value: "IN_PROGRESS", label: "En proceso" },
  { value: "COMPLETED", label: "Completadas" },
  { value: "ALL", label: "Todas" },
]

function money(value: number, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: currency || "PEN" }).format(value || 0)
}

function dateTime(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function shortDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(new Date(value))
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(url, { cache: "no-store", ...init })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message || "No se pudo completar la operación")
  }
  return response.json() as Promise<T>
}

function StatusBadge({ status }: { status: WarehouseStatus }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-1 text-[10px] font-bold", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function MessageSkeletons() {
  return (
    <div className="flex flex-col gap-3 py-4" aria-label="Cargando mensajes">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className={cn(
            "h-14 animate-pulse rounded-xl bg-background/70 shadow-sm",
            index % 2 === 0 ? "mr-auto w-[58%]" : "ml-auto w-[48%]",
          )}
        />
      ))}
    </div>
  )
}

function PreparationProductImage({ item }: { item: SaleItem }) {
  const [failed, setFailed] = useState(false)

  if (!item.imageUrl || failed) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 sm:h-20 sm:w-20">
        <ArchiveBoxIcon className="h-7 w-7" />
      </div>
    )
  }

  return (
    // Las imágenes de producto provienen del almacenamiento configurado por cada empresa.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.imageUrl}
      alt={item.description || "Producto del pedido"}
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded-xl bg-muted object-cover sm:h-20 sm:w-20"
    />
  )
}

function ProductsToPrepare({ items, sale }: { items: SaleItem[]; sale: WarehouseSale }) {
  const totalUnits = items.reduce((total, item) => total + (item.quantity || 0), 0)
  const completed = sale.warehouseStatus === "COMPLETED"
  const inProgress = sale.warehouseStatus === "IN_PROGRESS"

  return (
    <section className={cn(
      "mx-auto w-full max-w-xl overflow-hidden rounded-2xl border bg-background/95 shadow-lg backdrop-blur-sm",
      completed ? "border-emerald-500/30" : inProgress ? "border-blue-500/30" : "border-amber-500/30",
    )}>
      <header className={cn(
        "border-b border-border/70 px-4 py-3.5 sm:px-5",
        completed ? "bg-emerald-500/10" : inProgress ? "bg-blue-500/10" : "bg-amber-500/10",
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm",
            completed ? "bg-emerald-500" : inProgress ? "bg-blue-500" : "bg-amber-500",
          )}>
            {completed ? <CheckCircleIcon className="h-5 w-5" /> : <ArchiveBoxIcon className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-foreground">
                {completed ? "Productos alistados" : "Productos por alistar"}
              </p>
              <StatusBadge status={sale.warehouseStatus} />
            </div>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
              {sale.receiptType} · {sale.number}
            </p>
            <p className="text-xs text-muted-foreground">
              {items.length} producto{items.length === 1 ? "" : "s"} · {totalUnits} unidad{totalUnits === 1 ? "" : "es"}
            </p>
          </div>
        </div>
      </header>

      {items.length > 0 ? (
        <div className="max-h-[min(46vh,420px)] divide-y divide-border/70 overflow-y-auto">
          {items.map((item, index) => (
            <div key={`${item.description}-${index}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <PreparationProductImage item={item} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-foreground">
                  {item.description || "Producto sin nombre"}
                </p>
                <div className="mt-2 inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-200">
                  Cantidad: {item.quantity}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">
          Esta venta no tiene productos registrados.
        </div>
      )}

      <footer className="border-t border-border/70 px-4 py-3 text-center text-[11px] text-muted-foreground sm:px-5">
        {completed
          ? "Este pedido fue marcado como completado."
          : inProgress
            ? "El pedido se encuentra en proceso de alistamiento."
            : "Revisa y alista este pedido antes de contactar al cliente."}
      </footer>
    </section>
  )
}

function OrderRow({ order, active, onSelect }: { order: WarehouseSale; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/60",
        active && "bg-muted",
      )}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TruckIcon className="h-5 w-5" />
        {order.hasShippingChat && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-bold text-foreground">{order.customerName || "Cliente sin nombre"}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">{shortDate(order.createdAt)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {order.receiptType} · {order.number}
          </p>
          <span className="shrink-0 text-xs font-bold text-foreground">{money(order.total, order.currency)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            {order.hasSalesChat && <DocumentTextIcon className="h-3.5 w-3.5 text-blue-500" title="Chat de Ventas" />}
            {order.hasShippingChat && <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-emerald-500" title="Chat de Envíos" />}
            <span className="truncate">{order.customerPhone || "Sin teléfono"}</span>
          </div>
          <StatusBadge status={order.warehouseStatus} />
        </div>
      </div>
    </button>
  )
}

export default function ShippingPageView() {
  const [orders, setOrders] = useState<WarehouseSale[]>([])
  const [total, setTotal] = useState(0)
  const [hasMoreOrders, setHasMoreOrders] = useState(false)
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"ALL" | WarehouseStatus>("PENDING")
  const [pendingOrder, setPendingOrder] = useState<"FIRST" | "LATEST">("FIRST")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<WarehouseDetail | null>(null)
  const [tab, setTab] = useState<"sales" | "shipping">("sales")
  const [messages, setMessages] = useState<WarehouseChatMessage[]>([])
  const [messageMeta, setMessageMeta] = useState<{ oldestId: number | null; newestId: number | null; hasMoreBefore: boolean }>({ oldestId: null, newestId: null, hasMoreBefore: false })
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  const ordersRef = useRef<WarehouseSale[]>([])
  const loadingMoreOrdersRef = useRef(false)
  const messagesRef = useRef<WarehouseChatMessage[]>([])
  const messageMetaRef = useRef(messageMeta)
  const activeMessageViewRef = useRef("")
  const loadingOlderMessagesRef = useRef(false)
  const messageScrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadOrders = useCallback(async (options?: { append?: boolean; silent?: boolean; retainSize?: boolean }) => {
    const append = options?.append === true
    const silent = options?.silent === true
    if (append && loadingMoreOrdersRef.current) return
    if (append) {
      loadingMoreOrdersRef.current = true
      setLoadingMoreOrders(true)
    } else if (!silent) {
      setLoading(true)
    }
    try {
      const loaded = ordersRef.current.length
      const size = append ? ORDER_PAGE_SIZE : options?.retainSize ? Math.max(ORDER_PAGE_SIZE, loaded) : ORDER_PAGE_SIZE
      const page = append ? Math.floor(loaded / ORDER_PAGE_SIZE) : 0
      const params = new URLSearchParams({ q: query.trim(), status, order: pendingOrder, page: String(page), size: String(size) })
      const data = await api<WarehousePage>(`/api/crm/warehouse/orders?${params}`)
      const next = append
        ? Array.from(new Map([...ordersRef.current, ...data.content].map((order) => [order.saleId, order])).values())
        : data.content
      ordersRef.current = next
      setOrders(next)
      setTotal(data.totalElements)
      setHasMoreOrders(next.length < data.totalElements)
      setError("")
    } catch (reason) {
      if (!silent) setError(reason instanceof Error ? reason.message : "No se pudo cargar Envíos")
    } finally {
      if (!silent) setLoading(false)
      if (append) {
        loadingMoreOrdersRef.current = false
        setLoadingMoreOrders(false)
      }
    }
  }, [pendingOrder, query, status])

  const loadDetail = useCallback(async (saleId: number, silent = false) => {
    if (!silent) setDetailLoading(true)
    try {
      const data = await api<WarehouseDetail>(`/api/crm/warehouse/orders/${saleId}`)
      setDetail(data)
      setError("")
    } catch (reason) {
      if (!silent) setError(reason instanceof Error ? reason.message : "No se pudo abrir la venta")
    } finally {
      if (!silent) setDetailLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (
    saleId: number,
    targetTab: "sales" | "shipping",
    options?: { beforeId?: number; afterId?: number; refreshRecent?: boolean },
  ) => {
    const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) })
    if (options?.beforeId != null) params.set("beforeId", String(options.beforeId))
    if (options?.afterId != null) params.set("afterId", String(options.afterId))
    const endpoint = targetTab === "sales" ? "sales-messages" : "shipping-messages"
    const data = await api<WarehouseMessagePage>(`/api/crm/warehouse/orders/${saleId}/${endpoint}?${params}`)
    if (activeMessageViewRef.current !== `${saleId}:${targetTab}`) return
    const current = messagesRef.current
    const merged = options?.beforeId != null
      ? [...data.content, ...current]
      : options?.afterId != null
        ? [...current, ...data.content]
        : options?.refreshRecent
          ? [...current, ...data.content]
        : data.content
    const next = Array.from(new Map(merged.map((message) => [message.id, message])).values())
    const previousMeta = messageMetaRef.current
    const meta = {
      oldestId: options?.afterId != null || options?.refreshRecent ? previousMeta.oldestId ?? data.oldestId ?? null : data.oldestId ?? previousMeta.oldestId,
      newestId: options?.beforeId != null ? previousMeta.newestId : data.newestId ?? previousMeta.newestId,
      hasMoreBefore: options?.afterId != null || options?.refreshRecent ? previousMeta.hasMoreBefore || data.hasMoreBefore : data.hasMoreBefore,
    }
    messagesRef.current = next
    messageMetaRef.current = meta
    setMessages(next)
    setMessageMeta(meta)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ordersRef.current = []
      setOrders([])
      void loadOrders()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadOrders])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedId) return
      void loadDetail(selectedId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedId, loadDetail])

  useEffect(() => {
    const viewKey = selectedId ? `${selectedId}:${tab}` : ""
    activeMessageViewRef.current = viewKey
    const timer = window.setTimeout(() => {
      if (!selectedId) return
      const emptyMeta = { oldestId: null, newestId: null, hasMoreBefore: false }
      messagesRef.current = []
      messageMetaRef.current = emptyMeta
      setMessages([])
      setMessageMeta(emptyMeta)
      setMessagesLoading(true)
      void loadMessages(selectedId, tab)
        .then(() => {
          if (activeMessageViewRef.current === viewKey) {
            window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())
          }
        })
        .catch((reason) => {
          if (activeMessageViewRef.current === viewKey) {
            setError(reason instanceof Error ? reason.message : "No se pudo abrir el chat")
          }
        })
        .finally(() => {
          if (activeMessageViewRef.current === viewKey) setMessagesLoading(false)
        })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedId, tab, loadMessages])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadOrders({ silent: true, retainSize: true })
      if (selectedId) {
        void loadDetail(selectedId, true)
        void loadMessages(selectedId, tab, { refreshRecent: true })
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [loadOrders, loadDetail, loadMessages, selectedId, tab])

  useEffect(() => {
    const events = new EventSource("/api/crm/warehouse/events")
    const refresh = () => {
      void loadOrders({ silent: true, retainSize: true })
      if (selectedId) {
        void loadDetail(selectedId, true)
        void loadMessages(selectedId, tab, { refreshRecent: true })
      }
    }
    events.addEventListener("warehouse-event", refresh)
    return () => {
      events.removeEventListener("warehouse-event", refresh)
      events.close()
    }
  }, [loadOrders, loadDetail, loadMessages, selectedId, tab])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("crm:chat-mobile-view", { detail: { conversationOpen: selectedId !== null } }))
    return () => {
      window.dispatchEvent(new CustomEvent("crm:chat-mobile-view", { detail: { conversationOpen: false } }))
    }
  }, [selectedId])

  const loadOlderMessages = useCallback(async () => {
    if (!selectedId || loadingOlderMessagesRef.current || !messageMetaRef.current.oldestId || !messageMetaRef.current.hasMoreBefore) return
    const scroll = messageScrollRef.current
    const previousHeight = scroll?.scrollHeight ?? 0
    const previousTop = scroll?.scrollTop ?? 0
    loadingOlderMessagesRef.current = true
    setLoadingOlderMessages(true)
    try {
      await loadMessages(selectedId, tab, { beforeId: messageMetaRef.current.oldestId })
      window.requestAnimationFrame(() => {
        if (scroll) scroll.scrollTop = previousTop + (scroll.scrollHeight - previousHeight)
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial anterior")
    } finally {
      loadingOlderMessagesRef.current = false
      setLoadingOlderMessages(false)
    }
  }, [loadMessages, selectedId, tab])

  function handleMessagesScroll() {
    if (messageScrollRef.current && messageScrollRef.current.scrollTop <= 80) void loadOlderMessages()
  }

  function handleOrderListScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
    if (remaining <= 120 && hasMoreOrders && !loadingMoreOrdersRef.current) void loadOrders({ append: true })
  }

  async function changeStatus(next: WarehouseStatus) {
    if (!selectedId || !detail || next === detail.sale.warehouseStatus) return
    try {
      const updated = await api<WarehouseDetail>(`/api/crm/warehouse/orders/${selectedId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      setDetail(updated)
      await loadOrders({ silent: true, retainSize: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el estado")
    }
  }

  async function sendMessage() {
    if (!selectedId || !draft.trim() || sending) return
    setSending(true)
    try {
      await api(`/api/crm/warehouse/orders/${selectedId}/shipping-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft.trim() }),
      })
      setDraft("")
      await loadMessages(selectedId, "shipping", { refreshRecent: true })
      window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }))
      await loadDetail(selectedId, true)
      await loadOrders({ silent: true, retainSize: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo enviar el mensaje")
    } finally {
      setSending(false)
    }
  }

  async function sendFile(file: File) {
    if (!selectedId || sending) return
    setSending(true)
    const body = new FormData()
    body.append("file", file)
    body.append("caption", draft.trim())
    try {
      await api(`/api/crm/warehouse/orders/${selectedId}/shipping-media`, { method: "POST", body })
      setDraft("")
      await loadMessages(selectedId, "shipping", { refreshRecent: true })
      window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }))
      await loadDetail(selectedId, true)
      await loadOrders({ silent: true, retainSize: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo enviar el archivo")
    } finally {
      setSending(false)
    }
  }

  const shippingUnavailable = tab === "shipping" && detail && (!detail.sale.customerPhone || !detail.shippingOperational)
  const currentSaleMessageIndex = detail
    ? messages.findIndex((message) => message.relatedSaleId === detail.sale.saleId)
    : -1

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      {error && (
        <div role="alert" className="z-30 flex shrink-0 items-center gap-3 border-b border-red-300 bg-red-50 px-4 py-3 text-red-950 shadow-sm dark:border-red-500/30 dark:bg-red-950 dark:text-red-50 md:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-200/70 text-red-700 dark:bg-red-500/20 dark:text-red-300">
            <ExclamationTriangleIcon className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold">{error}</p>
          <button type="button" onClick={() => setError("")} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-200/60" aria-label="Cerrar aviso">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className={cn("w-full shrink-0 flex-col border-r border-border bg-background md:flex md:w-[360px] xl:w-[380px]", selectedId ? "hidden" : "flex")}>
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="relative flex h-10 flex-1 items-center">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cliente, teléfono o comprobante"
                  className="h-10 w-full rounded-full border-0 bg-muted pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-muted-foreground/30"
                />
              </div>
              <button
                type="button"
                onClick={() => void loadOrders({ retainSize: true })}
                disabled={loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Recargar ventas"
                title="Recargar ventas"
              >
                <ArrowPathIcon className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-border/70 bg-muted/35 p-1.5">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={status === filter.value}
                  onClick={() => setStatus(filter.value)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-all",
                    status === filter.value
                      ? "border-border bg-background text-foreground shadow-sm"
                      : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  {filter.value === "PENDING" ? <ExclamationTriangleIcon className="h-4 w-4 shrink-0" /> : <CheckCircleIcon className="h-4 w-4 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{filter.label}</span>
                  {status === filter.value && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background">{total}</span>
                  )}
                </button>
              ))}
            </div>
            {status === "PENDING" && (
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-full border border-border/70 bg-muted/35 p-1" aria-label="Orden de pendientes">
                <button
                  type="button"
                  aria-pressed={pendingOrder === "FIRST"}
                  onClick={() => setPendingOrder("FIRST")}
                  className={cn(
                    "h-8 rounded-full text-xs font-bold transition-colors",
                    pendingOrder === "FIRST" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Primeros
                </button>
                <button
                  type="button"
                  aria-pressed={pendingOrder === "LATEST"}
                  onClick={() => setPendingOrder("LATEST")}
                  className={cn(
                    "h-8 rounded-full text-xs font-bold transition-colors",
                    pendingOrder === "LATEST" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Últimos
                </button>
              </div>
            )}
          </div>

          <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto" onScroll={handleOrderListScroll}>
            {loading ? (
              <div className="space-y-3 px-4 py-5" aria-label="Cargando ventas">
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="flex animate-pulse items-center gap-3 py-2">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="min-w-0 flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-muted" /><div className="h-2.5 w-full rounded bg-muted" /></div>
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <TruckIcon className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-semibold text-muted-foreground">Sin ventas</p>
                <p className="mt-1 text-xs text-muted-foreground/70">No hay ventas que coincidan con este filtro.</p>
              </div>
            ) : (
              <>
                {orders.map((order) => (
                  <OrderRow
                    key={order.saleId}
                    order={order}
                    active={selectedId === order.saleId}
                    onSelect={() => {
                      if (selectedId !== order.saleId) setDetail(null)
                      setSelectedId(order.saleId)
                      setTab("shipping")
                    }}
                  />
                ))}
                {loadingMoreOrders && <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground"><ArrowPathIcon className="h-4 w-4 animate-spin" /> Cargando más ventas...</div>}
                {!hasMoreOrders && orders.length > 0 && <p className="py-4 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Fin del listado</p>}
              </>
            )}
          </div>
        </aside>

        <div className={cn("relative min-w-0 flex-1 flex-col bg-muted/60 md:flex", selectedId ? "flex" : "hidden")}>
          {!selectedId ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <ChatBubbleLeftRightIcon className="h-16 w-16 text-muted-foreground/40" />
              <p className="text-lg font-semibold text-muted-foreground">Selecciona una venta</p>
              <p className="text-sm text-muted-foreground/70">Revisa el pedido y sus conversaciones de Ventas y Envíos.</p>
            </div>
          ) : detailLoading || !detail ? (
            <div className="flex h-full items-center justify-center"><ArrowPathIcon className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <header className="shrink-0 border-b border-border bg-background">
                <div className={cn("flex min-h-[64px] flex-wrap items-center justify-between gap-2 border-l-4 px-3 py-2 md:min-h-[84px] md:flex-nowrap md:gap-4 md:px-4 md:py-3", detail.sale.cancelled ? "border-red-500" : detail.sale.warehouseStatus === "COMPLETED" ? "border-emerald-500" : detail.sale.warehouseStatus === "IN_PROGRESS" ? "border-blue-500" : "border-amber-500")}>
                  <div className="flex min-w-0 items-center gap-3">
                    <button type="button" onClick={() => { setSelectedId(null); setDetail(null) }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label="Volver a ventas">
                      <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    <ChatAvatar />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-bold text-foreground">{detail.sale.customerName || "Cliente sin nombre"}</h2>
                        {detail.sale.cancelled && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">ANULADA</span>}
                      </div>
                      <p className="mt-1 truncate text-xs text-foreground">{detail.sale.receiptType} {detail.sale.number} · {detail.sale.branch}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{detail.sale.customerPhone || "Sin teléfono disponible"}</p>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-center gap-2 md:w-auto md:justify-start">
                    <div className="flex items-center rounded-full border border-border bg-muted/70 p-1" aria-label="Estado de Envíos">
                      {(["PENDING", "IN_PROGRESS", "COMPLETED"] as WarehouseStatus[]).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          aria-pressed={detail.sale.warehouseStatus === nextStatus}
                          disabled={detail.sale.cancelled}
                          onClick={() => void changeStatus(nextStatus)}
                          className={cn(
                            "h-8 rounded-full px-2.5 text-[10px] font-bold transition-all disabled:opacity-40 md:px-3 md:text-xs",
                            detail.sale.warehouseStatus === nextStatus
                              ? STATUS_STYLE[nextStatus] + " shadow-sm"
                              : "text-muted-foreground hover:bg-background hover:text-foreground",
                          )}
                        >
                          {STATUS_LABEL[nextStatus]}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => void loadDetail(selectedId)} disabled={detailLoading} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Recargar detalle">
                      <ArrowPathIcon className={cn("h-5 w-5", detailLoading && "animate-spin")} />
                    </button>
                  </div>
                </div>

                <details className="border-t border-border/70 px-4 py-2">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center justify-between gap-3">
                      <span>Pedido · {detail.items.length} producto{detail.items.length === 1 ? "" : "s"} · {dateTime(detail.sale.createdAt)}</span>
                      <strong className="text-foreground">{money(detail.sale.total, detail.sale.currency)}</strong>
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]">
                    <div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-muted/30 px-3">
                      {detail.items.map((item, index) => (
                        <div key={`${item.description}-${index}`} className="flex justify-between gap-3 py-2.5">
                          <span className="min-w-0"><strong>{item.quantity}×</strong> {item.description}</span>
                          <strong className="shrink-0">{money(item.total, detail.sale.currency)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5 rounded-xl border border-border/70 bg-muted/30 p-3 text-muted-foreground">
                      <p><strong className="text-foreground">Documento:</strong> {detail.customerDocument || "No registrado"}</p>
                      <p><strong className="text-foreground">Dirección:</strong> {detail.customerAddress || "No registrada"}</p>
                      <p><strong className="text-foreground">Estado de venta:</strong> {detail.sale.saleStatus}</p>
                    </div>
                  </div>
                </details>

                <div className="grid grid-cols-2 border-t border-border">
                  <button type="button" onClick={() => { if (tab !== "sales") setMessagesLoading(true); setTab("sales") }} className={cn("flex h-11 items-center justify-center gap-2 border-b-2 text-xs font-bold transition-colors", tab === "sales" ? "border-blue-500 text-blue-600 dark:text-blue-300" : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                    <DocumentTextIcon className="h-4 w-4" /> Chat de Ventas
                  </button>
                  <button type="button" onClick={() => { if (tab !== "shipping") setMessagesLoading(true); setTab("shipping") }} className={cn("flex h-11 items-center justify-center gap-2 border-b-2 text-xs font-bold transition-colors", tab === "shipping" ? "border-emerald-500 text-emerald-600 dark:text-emerald-300" : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                    <TruckIcon className="h-4 w-4" /> Chat de Envíos
                  </button>
                </div>
              </header>

              <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/60">
                <ChatWallpaperLayer />
                <div ref={messageScrollRef} onScroll={handleMessagesScroll} className="sidebar-scroll relative z-10 h-full overflow-y-auto px-3 py-3 md:px-8">
                  <div className="flex min-h-full flex-col justify-end gap-3">
                    {loadingOlderMessages && <div className="mx-auto flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-sm"><ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Cargando mensajes anteriores...</div>}
                    {messagesLoading ? (
                      <MessageSkeletons />
                    ) : tab === "sales" && !detail.salesConversationId ? (
                      <div className="mx-auto my-auto max-w-sm rounded-xl bg-background/90 px-6 py-5 text-center shadow-sm">
                        <DocumentTextIcon className="mx-auto h-10 w-10 text-muted-foreground/40" />
                        <p className="mt-3 text-sm font-semibold">Esta venta no tiene conversación de Ventas</p>
                        <p className="mt-1 text-xs text-muted-foreground">La compra fue registrada desde otro canal.</p>
                      </div>
                    ) : tab === "shipping" ? (
                      <>
                        {messages.map((message, index) => (
                          <Fragment key={message.id}>
                            {index === currentSaleMessageIndex && (
                              <ProductsToPrepare items={detail.items} sale={detail.sale} />
                            )}
                            <WarehouseMessageBubble message={message} />
                          </Fragment>
                        ))}
                        {currentSaleMessageIndex === -1 && (
                          <ProductsToPrepare items={detail.items} sale={detail.sale} />
                        )}
                      </>
                    ) : messages.length === 0 ? (
                      <div className="mx-auto my-auto max-w-sm rounded-xl bg-background/90 px-6 py-5 text-center shadow-sm">
                        <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-muted-foreground/40" />
                        <p className="mt-3 text-sm font-semibold">Aún no hay mensajes</p>
                        <p className="mt-1 text-xs text-muted-foreground">No se encontraron mensajes en este chat.</p>
                      </div>
                    ) : messages.map((message) => <WarehouseMessageBubble key={message.id} message={message} />)}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>

              {tab === "sales" ? (
                <footer className="relative z-20 shrink-0 bg-muted/60 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-3 md:pb-3">
                  <ChatWallpaperLayer />
                  <div className="relative z-10 flex min-h-14 items-center justify-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 text-sm font-medium text-muted-foreground shadow-sm">
                    <CheckCircleIcon className="h-5 w-5 text-blue-500" /> Historial completo en modo lectura
                  </div>
                </footer>
              ) : shippingUnavailable ? (
                <footer className="relative z-20 shrink-0 bg-muted/60 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-3 md:pb-3">
                  <ChatWallpaperLayer />
                  <div className="relative z-10 flex min-h-14 items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 text-sm text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-100">
                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                    <span>{!detail.sale.customerPhone ? "Sin teléfono disponible. Envíos solo puede consultar esta venta." : detail.shippingBlockedReason || "WhatsApp de Envíos está desconectado."}</span>
                  </div>
                </footer>
              ) : (
                <footer className="relative z-20 shrink-0 bg-muted/60 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-3 md:pb-3">
                  <ChatWallpaperLayer />
                  <WarehouseChatComposer
                    value={draft}
                    onChange={setDraft}
                    onSendText={sendMessage}
                    onSendFile={sendFile}
                    disabled={detail.sale.cancelled}
                    sending={sending}
                    placeholder={detail.shippingConversationId ? "Escribe un mensaje" : "Primer mensaje para contactar al cliente"}
                  />
                </footer>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
