"use client"

import { Fragment, useCallback, useEffect, useRef, useState, type DragEvent, type UIEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  CheckCircleIcon,
  DocumentIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TagIcon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"

import { ChatAvatar } from "@/components/chat/ChatAvatar"
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator"
import { ChatConversationSkeletons, ChatMessageSkeletons } from "@/components/chat/ChatLoadingSkeletons"
import { ChatWallpaperLayer } from "@/components/chat/ChatWallpaperLayer"
import { conversationDayKey, formatConversationDayLabel, formatConversationListDate } from "@/lib/crm/conversation-date"
import { WarehouseChatComposer } from "@/components/chat/WarehouseChatComposer"
import { WarehouseMessageBubble, type WarehouseChatMessage } from "@/components/chat/WarehouseMessageBubble"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { authFetch } from "@/lib/auth/auth-fetch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type ConversationTag = {
  id: number
  label: string
  color: string
}

type TagResponse = {
  id: number
  nombre: string
  color: string
  uso: number
}

type ShippingConversation = {
  id: number
  phone: string
  phoneNumber?: string | null
  whatsappUsername?: string | null
  contactName?: string | null
  lastMessage?: string | null
  lastMessageType?: string | null
  lastMessageAt?: string | null
  unreadCount: number
  tags: ConversationTag[]
}

type ConversationPage = {
  content: ShippingConversation[]
  page: number
  size: number
  totalPages: number
  totalElements: number
  last: boolean
}

type MessagePage = {
  content: WarehouseChatMessage[]
  oldestId?: number | null
  newestId?: number | null
  hasMoreBefore: boolean
}

type SalesMessagePage = MessagePage & { available: boolean }

type ShippingConnection = {
  status: string
  phoneChanged?: boolean
  operationsBlocked?: boolean
  blockedReason?: string | null
}

type PendingAttachment = {
  id: string
  file: File
  url: string
}

const CONVERSATION_SIZE = 50
const MESSAGE_SIZE = 10
const MESSAGE_CACHE_LIMIT = 5
const TAG_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#eab308", "#a855f7", "#f97316", "#ec4899", "#14b8a6", "#6366f1", "#78716c"]

function contactName(conversation: ShippingConversation) {
  return conversation.contactName?.trim()
    || conversation.phoneNumber?.trim()
    || conversation.whatsappUsername?.trim()
    || "Cliente"
}

function contactPhone(conversation: ShippingConversation) {
  return conversation.phoneNumber?.trim()
    || conversation.whatsappUsername?.trim()
    || conversation.phone.replace(/@.+$/, "")
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(url, { cache: "no-store", ...init })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message || "No se pudo completar la operacion")
  }
  return response.json() as Promise<T>
}

export function ShippingChatPanel() {
  const searchParams = useSearchParams()
  const requestedConversationId = Number(searchParams.get("conversationId") || 0)
  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [conversations, setConversations] = useState<ShippingConversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState("")
  const [selected, setSelected] = useState<ShippingConversation | null>(null)
  const [messages, setMessages] = useState<WarehouseChatMessage[]>([])
  const [oldestId, setOldestId] = useState<number | null>(null)
  const [newestId, setNewestId] = useState<number | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [chatTab, setChatTab] = useState<"sales" | "shipping">("shipping")
  const [salesMessages, setSalesMessages] = useState<WarehouseChatMessage[]>([])
  const [salesOldestId, setSalesOldestId] = useState<number | null>(null)
  const [salesHasMoreMessages, setSalesHasMoreMessages] = useState(false)
  const [salesAvailable, setSalesAvailable] = useState<boolean | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesLoadingOlder, setSalesLoadingOlder] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null)
  const [attachmentCaption, setAttachmentCaption] = useState("")
  const [connection, setConnection] = useState<ShippingConnection | null>(null)
  const [availableTags, setAvailableTags] = useState<ConversationTag[]>([])
  const [selectedTagFilterId, setSelectedTagFilterId] = useState<number | null>(null)
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [tagsLoading, setTagsLoading] = useState(false)
  const [tagSaving, setTagSaving] = useState(false)
  const [newTagLabel, setNewTagLabel] = useState("")
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [mobileView, setMobileView] = useState<"list" | "conversation">("list")
  const selectedRef = useRef<ShippingConversation | null>(null)
  const dragDepthRef = useRef(0)
  const previewFileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([])
  const chatTabRef = useRef<"sales" | "shipping">("shipping")
  const conversationsRef = useRef<ShippingConversation[]>([])
  const conversationPageRef = useRef(0)
  const hasMoreConversationsRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const listRequestRef = useRef(0)
  const newestIdRef = useRef<number | null>(null)
  const messageRequestRef = useRef(0)
  const loadingOlderRef = useRef(false)
  const messageCacheRef = useRef<Record<number, { items: WarehouseChatMessage[]; oldestId: number | null; newestId: number | null; hasMoreBefore: boolean }>>({})
  const messageCacheLruRef = useRef<number[]>([])
  const salesRequestRef = useRef(0)
  const salesLoadingOlderRef = useRef(false)
  const salesAbortRef = useRef<AbortController | null>(null)
  const salesCacheRef = useRef<Record<number, { items: WarehouseChatMessage[]; oldestId: number | null; hasMoreBefore: boolean; available: boolean }>>({})
  const listAbortRef = useRef<AbortController | null>(null)
  const messageAbortRef = useRef<AbortController | null>(null)
  const conversationListRef = useRef<HTMLDivElement | null>(null)
  const messageScrollRef = useRef<HTMLDivElement | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  const handledRequestedConversationRef = useRef<number | null>(null)

  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { chatTabRef.current = chatTab }, [chatTab])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])
  useEffect(() => { newestIdRef.current = newestId }, [newestId])

  useEffect(() => () => {
    pendingAttachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
  }, [])

  useEffect(() => {
    if (pendingAttachments.length === 0) return
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) {
        pendingAttachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
        pendingAttachmentsRef.current = []
        setPendingAttachments([])
        setActiveAttachmentId(null)
        setAttachmentCaption("")
      }
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [pendingAttachments.length, sending])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("crm:chat-mobile-view", {
      detail: { conversationOpen: mobileView === "conversation" },
    }))
    return () => {
      window.dispatchEvent(new CustomEvent("crm:chat-mobile-view", {
        detail: { conversationOpen: false },
      }))
    }
  }, [mobileView])

  const loadConnection = useCallback(async () => {
    try {
      setConnection(await api<ShippingConnection>("/api/crm/whatsapp/connections/shipping/status"))
    } catch {
      setConnection({ status: "DISCONNECTED", operationsBlocked: true, blockedReason: "WhatsApp de Envios desconectado" })
    }
  }, [])

  const loadAvailableTags = useCallback(async () => {
    setTagsLoading(true)
    try {
      const data = await api<TagResponse[]>("/api/crm/whatsapp/shipping/tags")
      setAvailableTags(data.map((tag) => ({ id: tag.id, label: tag.nombre, color: tag.color })))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar las etiquetas")
    } finally {
      setTagsLoading(false)
    }
  }, [])

  const loadConversations = useCallback(async (mode: "reset" | "append" | "refresh" = "reset") => {
    const append = mode === "append"
    if (append && (loadingMoreRef.current || !hasMoreConversationsRef.current)) return
    if (append) loadingMoreRef.current = true
    else listAbortRef.current?.abort()
    const controller = new AbortController()
    listAbortRef.current = controller
    const requestId = ++listRequestRef.current
    const page = append ? conversationPageRef.current + 1 : 0
    if (append) setLoadingMore(true)
    else setLoadingConversations(true)
    setListError("")
    try {
      const params = new URLSearchParams({ page: String(page), size: String(CONVERSATION_SIZE) })
      if (query) params.set("q", query)
      if (selectedTagFilterId != null) params.set("tagId", String(selectedTagFilterId))
      const data = await api<ConversationPage>(`/api/crm/whatsapp/shipping/conversations?${params}`, {
        signal: controller.signal,
      })
      if (controller.signal.aborted || requestId !== listRequestRef.current) return
      const current = conversationsRef.current
      const merged = append
        ? Array.from(new Map([...current, ...data.content].map((item) => [item.id, item])).values())
        : mode === "refresh" && selectedTagFilterId == null
          ? Array.from(new Map([...data.content, ...current].map((item) => [item.id, item])).values())
              .slice(0, Math.max(CONVERSATION_SIZE, current.length))
          : data.content
      conversationsRef.current = merged
      setConversations(merged)
      conversationPageRef.current = append ? data.page : mode === "refresh" ? conversationPageRef.current : data.page
      const hasMore = merged.length < data.totalElements
      hasMoreConversationsRef.current = hasMore
      const active = selectedRef.current
      if (active) {
        const updated = data.content.find((item) => item.id === active.id)
        if (updated) setSelected(updated)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setListError(error instanceof Error ? error.message : "No se pudieron cargar los chats")
    } finally {
      if (!controller.signal.aborted && requestId === listRequestRef.current) {
        setLoadingConversations(false)
        setLoadingMore(false)
        loadingMoreRef.current = false
      }
    }
  }, [query, selectedTagFilterId])

  const loadMessages = useCallback(async (
    conversationId: number,
    options?: { beforeId?: number; afterId?: number; preserve?: boolean },
  ) => {
    const older = options?.beforeId != null
    if (older && loadingOlderRef.current) return
    messageAbortRef.current?.abort()
    const controller = new AbortController()
    messageAbortRef.current = controller
    const requestId = ++messageRequestRef.current
    if (older) {
      loadingOlderRef.current = true
      setLoadingOlder(true)
    } else {
      loadingOlderRef.current = false
      setLoadingOlder(false)
      if (!options?.preserve) setLoadingMessages(true)
    }
    const scroll = messageScrollRef.current
    const previousHeight = scroll?.scrollHeight || 0
    const params = new URLSearchParams({ limit: String(MESSAGE_SIZE) })
    if (options?.beforeId != null) params.set("beforeId", String(options.beforeId))
    if (options?.afterId != null) params.set("afterId", String(options.afterId))
    try {
      const data = await api<MessagePage>(
        `/api/crm/whatsapp/shipping/conversations/${conversationId}/messages?${params}`,
        { signal: controller.signal },
      )
      if (controller.signal.aborted || requestId !== messageRequestRef.current || selectedRef.current?.id !== conversationId) return
      const cached = messageCacheRef.current[conversationId]
      const existing = cached?.items ?? []
      const combined = older ? [...data.content, ...existing]
        : options?.preserve ? [...existing, ...data.content] : data.content
      const items = Array.from(new Map(combined.map((item) => [item.id, item])).values())
        .sort((a, b) => a.id - b.id)
      const nextOldestId = data.oldestId != null
        ? older && cached?.oldestId != null ? Math.min(cached.oldestId, data.oldestId) : data.oldestId
        : cached?.oldestId ?? null
      const nextNewestId = data.newestId != null ? Math.max(cached?.newestId || 0, data.newestId) : cached?.newestId ?? null
      const hasMoreBefore = options?.afterId ? cached?.hasMoreBefore ?? false : data.hasMoreBefore
      messageCacheRef.current[conversationId] = { items, oldestId: nextOldestId, newestId: nextNewestId, hasMoreBefore }
      const nextLru = [conversationId, ...messageCacheLruRef.current.filter((id) => id !== conversationId)]
      for (const evictedId of nextLru.slice(MESSAGE_CACHE_LIMIT)) delete messageCacheRef.current[evictedId]
      messageCacheLruRef.current = nextLru.slice(0, MESSAGE_CACHE_LIMIT)
      setMessages(items)
      setOldestId(nextOldestId)
      setNewestId(nextNewestId)
      setHasMoreMessages(hasMoreBefore)
      requestAnimationFrame(() => {
        const target = messageScrollRef.current
        if (!target || chatTabRef.current !== "shipping") return
        if (older) target.scrollTop = target.scrollHeight - previousHeight
        else if (!options?.preserve || data.content.length > 0) target.scrollTop = target.scrollHeight
      })
    } catch (error) {
      if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : "No se cargaron los mensajes")
    } finally {
      if (!controller.signal.aborted && requestId === messageRequestRef.current) {
        messageAbortRef.current = null
        setLoadingMessages(false)
        setLoadingOlder(false)
        loadingOlderRef.current = false
      }
    }
  }, [])

  const loadSalesMessages = useCallback(async (conversationId: number, beforeId?: number) => {
    const older = beforeId != null
    if (older && salesLoadingOlderRef.current) return
    salesAbortRef.current?.abort()
    const controller = new AbortController()
    salesAbortRef.current = controller
    const requestId = ++salesRequestRef.current
    if (older) {
      salesLoadingOlderRef.current = true
      setSalesLoadingOlder(true)
    } else {
      setSalesLoading(true)
    }
    const scroll = messageScrollRef.current
    const previousHeight = scroll?.scrollHeight || 0
    const previousTop = scroll?.scrollTop || 0
    const params = new URLSearchParams({ limit: String(MESSAGE_SIZE) })
    if (beforeId != null) params.set("beforeId", String(beforeId))
    try {
      const data = await api<SalesMessagePage>(
        `/api/crm/whatsapp/shipping/conversations/${conversationId}/sales-messages?${params}`,
        { signal: controller.signal },
      )
      if (controller.signal.aborted || requestId !== salesRequestRef.current || selectedRef.current?.id !== conversationId) return
      const cached = salesCacheRef.current[conversationId]
      const items = Array.from(new Map([
        ...(older ? data.content : []),
        ...(older ? cached?.items ?? [] : data.content),
      ].map((item) => [item.id, item])).values()).sort((a, b) => a.id - b.id)
      const oldest = data.oldestId ?? cached?.oldestId ?? null
      const next = { items, oldestId: oldest, hasMoreBefore: data.hasMoreBefore, available: data.available }
      salesCacheRef.current[conversationId] = next
      setSalesMessages(items)
      setSalesOldestId(oldest)
      setSalesHasMoreMessages(data.hasMoreBefore)
      setSalesAvailable(data.available)
      requestAnimationFrame(() => {
        const target = messageScrollRef.current
        if (!target) return
        target.scrollTop = older ? previousTop + (target.scrollHeight - previousHeight) : target.scrollHeight
      })
    } catch (error) {
      if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : "No se cargó el chat de Ventas")
    } finally {
      if (!controller.signal.aborted && requestId === salesRequestRef.current) {
        salesAbortRef.current = null
        salesLoadingOlderRef.current = false
        setSalesLoading(false)
        setSalesLoadingOlder(false)
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [queryInput])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setConversations([])
      conversationsRef.current = []
      conversationPageRef.current = 0
      hasMoreConversationsRef.current = false
      void loadConversations("reset")
    }, 0)
    return () => window.clearTimeout(timer)
  // loadConversations changes as paging state changes; a search should reset only when its value changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedTagFilterId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAvailableTags(), 0)
    return () => window.clearTimeout(timer)
  }, [loadAvailableTags])

  useEffect(() => {
    const list = conversationListRef.current
    if (!list) return

    const loadUntilScrollable = () => {
      const doesNotFillViewport = list.scrollHeight <= list.clientHeight + 1
      if (doesNotFillViewport && hasMoreConversationsRef.current && !loadingMoreRef.current) {
        void loadConversations("append")
      }
    }

    const timer = window.setTimeout(loadUntilScrollable, 0)
    const observer = new ResizeObserver(loadUntilScrollable)
    observer.observe(list)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [conversations.length, loadConversations])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConnection(), 0)
    return () => {
      window.clearTimeout(timer)
      listAbortRef.current?.abort()
      messageAbortRef.current?.abort()
      salesAbortRef.current?.abort()
    }
  // initial fetch only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const source = new EventSource("/api/crm/warehouse/events")
    const refresh = () => {
      if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(() => {
        void loadConversations("refresh")
        const active = selectedRef.current
        if (active && newestIdRef.current != null) {
          void loadMessages(active.id, { afterId: newestIdRef.current, preserve: true })
        } else if (active) {
          void loadMessages(active.id)
        }
        void loadConnection()
      }, 180)
    }
    source.addEventListener("warehouse-event", refresh)
    return () => {
      source.close()
      if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current)
    }
  }, [loadConnection, loadConversations, loadMessages])

  async function selectConversation(conversation: ShippingConversation) {
    messageAbortRef.current?.abort()
    salesAbortRef.current?.abort()
    loadingOlderRef.current = false
    setLoadingOlder(false)
    selectedRef.current = conversation
    setSelected(conversation)
    setChatTab("shipping")
    chatTabRef.current = "shipping"
    const cachedSales = salesCacheRef.current[conversation.id]
    setSalesMessages(cachedSales?.items ?? [])
    setSalesOldestId(cachedSales?.oldestId ?? null)
    setSalesHasMoreMessages(cachedSales?.hasMoreBefore ?? false)
    setSalesAvailable(cachedSales?.available ?? null)
    setSalesLoading(false)
    setSalesLoadingOlder(false)
    const cached = messageCacheRef.current[conversation.id]
    setMessages(cached?.items ?? [])
    setOldestId(cached?.oldestId ?? null)
    setNewestId(cached?.newestId ?? null)
    setHasMoreMessages(cached?.hasMoreBefore ?? false)
    setDraft("")
    setMobileView("conversation")
    if (cached?.newestId != null) await loadMessages(conversation.id, { afterId: cached.newestId, preserve: true })
    else await loadMessages(conversation.id)
    setConversations((current) => current.map((item) => item.id === conversation.id
      ? { ...item, unreadCount: 0 } : item))
  }

  useEffect(() => {
    if (!Number.isSafeInteger(requestedConversationId) || requestedConversationId <= 0
        || handledRequestedConversationRef.current === requestedConversationId) return
    let cancelled = false
    const openRequestedConversation = async () => {
      const listed = conversationsRef.current.find((conversation) => conversation.id === requestedConversationId)
      if (listed) {
        if (!cancelled) {
          handledRequestedConversationRef.current = requestedConversationId
          await selectConversation(listed)
        }
        return
      }
      try {
        const conversation = await api<ShippingConversation>(
          `/api/crm/whatsapp/shipping/conversations/${requestedConversationId}`,
        )
        if (cancelled) return
        handledRequestedConversationRef.current = requestedConversationId
        conversationsRef.current = Array.from(new Map(
          [conversation, ...conversationsRef.current].map((item) => [item.id, item]),
        ).values())
        setConversations(conversationsRef.current)
        await selectConversation(conversation)
      } catch (error) {
        if (!cancelled) setListError(error instanceof Error ? error.message : "No se pudo abrir el chat solicitado")
      }
    }
    void openRequestedConversation()
    return () => { cancelled = true }
  // La URL solicita una conversación una sola vez; selectConversation es una declaración estable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedConversationId])

  function selectChatTab(tab: "sales" | "shipping") {
    if (!selected || tab === chatTab) return
    setChatTab(tab)
    chatTabRef.current = tab
    if (tab === "sales") {
      const cached = salesCacheRef.current[selected.id]
      if (cached) {
        setSalesMessages(cached.items)
        setSalesOldestId(cached.oldestId)
        setSalesHasMoreMessages(cached.hasMoreBefore)
        setSalesAvailable(cached.available)
        requestAnimationFrame(() => {
          if (messageScrollRef.current) messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight
        })
      } else {
        void loadSalesMessages(selected.id)
      }
    } else {
      requestAnimationFrame(() => {
        if (messageScrollRef.current) messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight
      })
    }
  }

  async function sendText() {
    if (!selected || !draft.trim() || sending) return
    setSending(true)
    try {
      const message = await api<WarehouseChatMessage>(
        `/api/crm/whatsapp/shipping/conversations/${selected.id}/messages`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: draft.trim() }) },
      )
      setDraft("")
      setMessages((current) => {
        const items = Array.from(new Map([...current, message].map((item) => [item.id, item])).values())
        const cached = messageCacheRef.current[selected.id]
        messageCacheRef.current[selected.id] = {
          items,
          oldestId: cached?.oldestId ?? message.id,
          newestId: message.id,
          hasMoreBefore: cached?.hasMoreBefore ?? false,
        }
        return items
      })
      setNewestId(message.id)
      requestAnimationFrame(() => { if (messageScrollRef.current) messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight })
      void loadConversations("refresh")
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo enviar el mensaje")
    } finally {
      setSending(false)
    }
  }

  async function sendFile(file: File, caption = "") {
    if (!selected || sending) return
    setSending(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("caption", caption)
      const message = await api<WarehouseChatMessage>(
        `/api/crm/whatsapp/shipping/conversations/${selected.id}/media`,
        { method: "POST", body: form },
      )
      setMessages((current) => {
        const items = Array.from(new Map([...current, message].map((item) => [item.id, item])).values())
        const cached = messageCacheRef.current[selected.id]
        messageCacheRef.current[selected.id] = {
          items,
          oldestId: cached?.oldestId ?? message.id,
          newestId: message.id,
          hasMoreBefore: cached?.hasMoreBefore ?? false,
        }
        return items
      })
      setNewestId(message.id)
      requestAnimationFrame(() => { if (messageScrollRef.current) messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight })
      void loadConversations("refresh")
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo enviar el archivo")
    } finally {
      setSending(false)
    }
  }

  function addPendingFiles(files: File[]) {
    if (files.length === 0) return
    const next = files.map((file, index) => ({
      id: `shipping-attachment-${Date.now()}-${index}-${file.name}`,
      file,
      url: URL.createObjectURL(file),
    }))
    setPendingAttachments((current) => {
      const updated = [...current, ...next]
      pendingAttachmentsRef.current = updated
      return updated
    })
    setActiveAttachmentId((current) => current || next[0].id)
  }

  function removePendingFile(id: string) {
    setPendingAttachments((current) => {
      const removed = current.find((item) => item.id === id)
      if (removed) URL.revokeObjectURL(removed.url)
      const updated = current.filter((item) => item.id !== id)
      pendingAttachmentsRef.current = updated
      setActiveAttachmentId((active) => active === id ? updated[0]?.id ?? null : active)
      return updated
    })
  }

  function closeAttachmentPreview() {
    if (sending) return
    pendingAttachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
    pendingAttachmentsRef.current = []
    setPendingAttachments([])
    setActiveAttachmentId(null)
    setAttachmentCaption("")
  }

  async function sendPendingFiles() {
    if (pendingAttachments.length === 0 || sending) return
    const files = [...pendingAttachments]
    for (let index = 0; index < files.length; index += 1) {
      await sendFile(files[index].file, index === 0 ? attachmentCaption.trim() : "")
    }
    closeAttachmentPreview()
  }

  function hasDraggedFiles(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes("Files")
  }

  function onFileDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!selected || chatTab !== "shipping" || blocked || sending || !hasDraggedFiles(event)) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFiles(true)
  }

  function onFileDragOver(event: DragEvent<HTMLDivElement>) {
    if (!selected || chatTab !== "shipping" || blocked || sending || !hasDraggedFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  function onFileDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDraggingFiles(false)
  }

  function onFileDrop(event: DragEvent<HTMLDivElement>) {
    if (!selected || chatTab !== "shipping" || blocked || sending || !hasDraggedFiles(event)) return
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFiles(false)
    addPendingFiles(Array.from(event.dataTransfer.files))
  }

  function onConversationScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget
    if (target.scrollHeight - target.scrollTop - target.clientHeight <= 120) void loadConversations("append")
  }

  function onMessageScroll(event: UIEvent<HTMLDivElement>) {
    if (chatTab === "sales") {
      if (event.currentTarget.scrollTop <= 80 && selected && salesOldestId != null
          && salesHasMoreMessages && !salesLoadingOlderRef.current) {
        void loadSalesMessages(selected.id, salesOldestId)
      }
      return
    }
    if (event.currentTarget.scrollTop <= 80 && selected && oldestId != null && hasMoreMessages && !loadingOlderRef.current) {
      void loadMessages(selected.id, { beforeId: oldestId })
    }
  }

  function setConversationTags(conversationId: number, tags: ConversationTag[]) {
    setConversations((current) => {
      const updated = current.map((conversation) => conversation.id === conversationId ? { ...conversation, tags } : conversation)
      conversationsRef.current = updated
      return updated
    })
    setSelected((current) => current?.id === conversationId ? { ...current, tags } : current)
  }

  async function assignTag(tagId: number) {
    if (!selected || tagSaving) return
    setTagSaving(true)
    try {
      const tags = await api<ConversationTag[]>(
        `/api/crm/whatsapp/shipping/conversations/${selected.id}/tags/${tagId}`,
        { method: "POST" },
      )
      setConversationTags(selected.id, tags)
      toast.success("Etiqueta asignada")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo asignar la etiqueta")
    } finally {
      setTagSaving(false)
    }
  }

  async function createAndAssignTag() {
    if (!selected || !newTagLabel.trim() || tagSaving) return
    const label = newTagLabel.trim()
    const existing = availableTags.find((tag) => tag.label.toLowerCase() === label.toLowerCase())
    setTagSaving(true)
    try {
      let tagId = existing?.id
      if (tagId == null) {
        const created = await api<TagResponse>("/api/crm/whatsapp/shipping/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: label, color: newTagColor }),
        })
        tagId = created.id
        setAvailableTags((current) => [...current, { id: created.id, label: created.nombre, color: created.color }]
          .sort((left, right) => left.label.localeCompare(right.label)))
      }
      const tags = await api<ConversationTag[]>(
        `/api/crm/whatsapp/shipping/conversations/${selected.id}/tags/${tagId}`,
        { method: "POST" },
      )
      setConversationTags(selected.id, tags)
      setNewTagLabel("")
      setNewTagColor(TAG_COLORS[0])
      toast.success(existing ? "Etiqueta asignada" : "Etiqueta creada y asignada")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la etiqueta")
    } finally {
      setTagSaving(false)
    }
  }

  async function removeTag(tagId: number) {
    if (!selected || tagSaving) return
    setTagSaving(true)
    try {
      const tags = await api<ConversationTag[]>(
        `/api/crm/whatsapp/shipping/conversations/${selected.id}/tags/${tagId}`,
        { method: "DELETE" },
      )
      setConversationTags(selected.id, tags)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo quitar la etiqueta")
    } finally {
      setTagSaving(false)
    }
  }

  function openTagModal() {
    if (!selected) return
    setNewTagLabel("")
    setNewTagColor(TAG_COLORS[0])
    setTagModalOpen(true)
    void loadAvailableTags()
  }

  const blocked = connection == null || connection.status !== "CONNECTED"
    || Boolean(connection.phoneChanged || connection.operationsBlocked)
  const activeAttachment = pendingAttachments.find((item) => item.id === activeAttachmentId) ?? pendingAttachments[0]
  const blockedReason = connection?.phoneChanged
    ? "Un administrador debe confirmar el nuevo número antes de responder mensajes."
    : "WhatsApp de Envíos está desconectado. Ve a Conexiones para volver a vincularlo."

  return (
    <section className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
      {blocked && connection && (
        <div
          role="alert"
          className="z-30 flex shrink-0 items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-50 md:px-6"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-200/70 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
            <ExclamationTriangleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold md:text-base">
              {connection.phoneChanged ? "WhatsApp de Envíos cambió de número" : "WhatsApp de Envíos está desconectado"}
            </p>
            <p className="mt-0.5 hidden text-xs text-amber-800 dark:text-amber-200 sm:block">{blockedReason}</p>
          </div>
          <Link
            href="/conexiones"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-900 px-3 text-xs font-bold text-white transition hover:bg-amber-950 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300 md:px-4 md:text-sm"
          >
            Ir a Conexiones
          </Link>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
      <aside className={cn(
        "min-h-0 w-full shrink-0 flex-col border-r border-border bg-background md:flex md:w-[360px] xl:w-[380px]",
        mobileView === "list" ? "flex" : "hidden",
      )}>
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="relative flex h-10 flex-1 items-center">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Buscar por número de celular o nombre ..."
                className="h-10 w-full rounded-full border-0 bg-muted pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-muted-foreground/30"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={loadingConversations}
              onClick={() => void loadConversations("reset")}
              className="h-9 w-9 rounded-full text-muted-foreground"
              aria-label="Actualizar chats de Envios"
            >
              <ArrowPathIcon className={cn("h-4 w-4", loadingConversations && "animate-spin")} />
            </Button>
          </div>
          <div className="tag-filter-scroll mt-3 flex w-full items-center gap-2 overflow-x-auto pb-2" aria-label="Filtros por etiqueta">
            <button
              type="button"
              onClick={() => setSelectedTagFilterId(null)}
              aria-pressed={selectedTagFilterId == null}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors",
                selectedTagFilterId == null
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <TagIcon className="h-3.5 w-3.5" /> Todas
            </button>
            {tagsLoading ? (
              <span className="shrink-0 text-xs text-muted-foreground">Cargando etiquetas...</span>
            ) : availableTags.length === 0 ? (
              <span className="shrink-0 text-xs text-muted-foreground">Sin etiquetas</span>
            ) : availableTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setSelectedTagFilterId(tag.id)}
                aria-pressed={selectedTagFilterId === tag.id}
                className={cn(
                  "inline-flex h-7 max-w-40 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors",
                  selectedTagFilterId === tag.id
                    ? "border-transparent text-white shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={selectedTagFilterId === tag.id ? { backgroundColor: tag.color } : undefined}
                title={tag.label}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedTagFilterId === tag.id ? "currentColor" : tag.color }} />
                <span className="truncate">{tag.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div ref={conversationListRef} className="sidebar-scroll min-h-0 flex-1 overflow-y-auto" onScroll={onConversationScroll}>
          {loadingConversations && conversations.length === 0 ? <ChatConversationSkeletons label="Cargando chats de Envíos" /> : listError && conversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold">No se pudieron cargar los chats</p>
              <p className="mt-1 text-xs text-muted-foreground">{listError}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadConversations("reset")}>Reintentar</Button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">{query ? "Sin resultados" : "Sin chats"}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {query ? "Prueba con otro nombre o número." : "Los mensajes de Envíos aparecerán aquí."}
              </p>
            </div>
          ) : conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => void selectConversation(conversation)}
              className={cn(
                "group relative flex w-full gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/60",
                selected?.id === conversation.id ? "bg-muted" : "bg-background",
              )}
            >
              {selected?.id === conversation.id && <span className="absolute left-0 top-0 h-full w-1 bg-muted-foreground" />}
              <ChatAvatar />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{contactName(conversation)}</p>
                  <span className="shrink-0 text-[11px] text-foreground">{formatConversationListDate(conversation.lastMessageAt)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className={cn("min-w-0 flex-1 truncate text-xs", conversation.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {conversation.lastMessage || "Sin último mensaje"}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold leading-none text-white">
                      {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                    </span>
                  )}
                </div>
                {conversation.tags?.length > 0 && (
                  <div className="mt-1.5 flex min-w-0 gap-1 overflow-hidden">
                    {conversation.tags.slice(0, 3).map((tag) => (
                      <span key={tag.id} className="max-w-24 truncate rounded-full px-2 py-0.5 text-[9px] font-semibold text-white" style={{ backgroundColor: tag.color }}>{tag.label}</span>
                    ))}
                    {conversation.tags.length > 3 && <span className="text-[9px] font-semibold text-muted-foreground">+{conversation.tags.length - 3}</span>}
                  </div>
                )}
              </div>
            </button>
          ))}
          {loadingMore && <p className="py-4 text-center text-xs text-muted-foreground">Cargando chats...</p>}
        </div>
      </aside>

      <div className={cn(
        "relative min-h-0 min-w-0 flex-1 flex-col bg-muted/60 md:flex",
        mobileView === "conversation" ? "flex" : "hidden",
      )} onDragEnter={onFileDragEnter} onDragOver={onFileDragOver} onDragLeave={onFileDragLeave} onDrop={onFileDrop}>
        {isDraggingFiles ? (
          <div className="pointer-events-none absolute inset-3 z-[70] flex items-center justify-center rounded-3xl border-2 border-dashed border-emerald-500 bg-background/95 p-6 shadow-2xl backdrop-blur-sm">
            <div className="text-center text-emerald-700 dark:text-emerald-300">
              <DocumentPlusIcon className="mx-auto h-12 w-12" />
              <p className="mt-3 text-base font-bold">Suelta tus archivos aquí</p>
              <p className="mt-1 text-xs text-muted-foreground">Puedes enviar varias fotos o documentos a la vez.</p>
            </div>
          </div>
        ) : null}
        {selected ? (
          <>
            <header className="z-10 flex min-h-[64px] shrink-0 items-center gap-3 border-b border-l-4 border-border border-l-muted-foreground bg-background px-3 py-2 md:min-h-[84px] md:px-4 md:py-3">
              <button type="button" onClick={() => setMobileView("list")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden" aria-label="Volver a chats">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <ChatAvatar />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold sm:text-base">{contactName(selected)}</p>
                <p className="truncate text-xs text-muted-foreground">{contactPhone(selected)}</p>
                {selected.tags?.length > 0 && (
                  <div className="mt-1 flex max-w-full gap-1 overflow-hidden">
                    {selected.tags.map((tag) => <span key={tag.id} className="max-w-28 truncate rounded-full px-2 py-0.5 text-[9px] font-semibold text-white" style={{ backgroundColor: tag.color }}>{tag.label}</span>)}
                  </div>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={openTagModal} className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Administrar etiquetas" title="Etiquetas de Envíos">
                <TagIcon className="h-5 w-5" />
              </Button>
              <div className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-200 sm:flex">
                <TruckIcon className="h-4 w-4" /> Envíos
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={chatTab === "sales" ? salesLoading : loadingMessages}
                onClick={() => {
                  if (chatTab === "sales") void loadSalesMessages(selected.id)
                  else void loadMessages(selected.id)
                }}
                className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={chatTab === "sales" ? "Recargar historial de Ventas" : "Recargar mensajes de Envíos"}
                title={chatTab === "sales" ? "Recargar historial de Ventas" : "Recargar mensajes de Envíos"}
              >
                <ArrowPathIcon className={cn(
                  "h-5 w-5",
                  (chatTab === "sales" ? salesLoading : loadingMessages) && "animate-spin",
                )} />
              </Button>
            </header>

            <div className="z-10 grid shrink-0 grid-cols-2 border-b border-border bg-background">
              <button
                type="button"
                onClick={() => selectChatTab("sales")}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 border-b-2 text-xs font-bold transition-colors",
                  chatTab === "sales"
                    ? "border-blue-500 text-blue-600 dark:text-blue-300"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <DocumentTextIcon className="h-4 w-4" /> Chat de Ventas
              </button>
              <button
                type="button"
                onClick={() => selectChatTab("shipping")}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 border-b-2 text-xs font-bold transition-colors",
                  chatTab === "shipping"
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-300"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <TruckIcon className="h-4 w-4" /> Chat de Envíos
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/60">
              <ChatWallpaperLayer />
              <div ref={messageScrollRef} onScroll={onMessageScroll} className="sidebar-scroll relative z-10 h-full overflow-y-auto px-3 py-3 md:px-8">
                <div className="flex min-h-full flex-col justify-end gap-3">
                  {chatTab === "sales" ? salesLoading && salesMessages.length === 0 ? (
                    <ChatMessageSkeletons />
                  ) : (
                    <>
                      {salesLoadingOlder && <ChatMessageSkeletons compact />}
                      {salesAvailable === false ? (
                        <div className="mx-auto my-auto max-w-sm rounded-xl bg-background/90 px-6 py-5 text-center shadow-sm">
                          <DocumentTextIcon className="mx-auto h-10 w-10 text-muted-foreground/40" />
                          <p className="mt-3 text-sm font-semibold">Este cliente no tiene conversación de Ventas</p>
                          <p className="mt-1 text-xs text-muted-foreground">Solo se encontró el historial del número de Envíos.</p>
                        </div>
                      ) : salesAvailable && salesMessages.length === 0 ? (
                        <div className="mx-auto my-auto max-w-sm rounded-xl bg-background/90 px-6 py-5 text-center shadow-sm">
                          <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-muted-foreground/40" />
                          <p className="mt-3 text-sm font-semibold">Aún no hay mensajes de Ventas</p>
                        </div>
                      ) : salesMessages.map((message, index) => (
                        <Fragment key={message.id}>
                          {conversationDayKey(message.createdAt) !== conversationDayKey(salesMessages[index - 1]?.createdAt) && (
                            <ChatDateSeparator label={formatConversationDayLabel(message.createdAt)} />
                          )}
                          <WarehouseMessageBubble message={message} />
                        </Fragment>
                      ))}
                    </>
                  ) : loadingMessages && messages.length === 0 ? <ChatMessageSkeletons /> : (
                    <>
                      {loadingOlder && <ChatMessageSkeletons compact />}
                      {messages.map((message, index) => (
                        <Fragment key={message.id}>
                          {conversationDayKey(message.createdAt) !== conversationDayKey(messages[index - 1]?.createdAt) && (
                            <ChatDateSeparator label={formatConversationDayLabel(message.createdAt)} />
                          )}
                          <WarehouseMessageBubble message={message} />
                        </Fragment>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            {chatTab === "sales" ? (
              <footer className="relative z-20 shrink-0 bg-muted/60 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-3 md:pb-3">
                <ChatWallpaperLayer />
                <div className="relative z-10 flex min-h-14 items-center justify-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 text-sm font-medium text-muted-foreground shadow-sm">
                  <CheckCircleIcon className="h-5 w-5 text-blue-500" /> Historial de Ventas en modo lectura
                </div>
              </footer>
            ) : (
            <footer className="relative z-20 shrink-0 bg-muted/60 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-3 md:pb-3">
              <ChatWallpaperLayer />
              <WarehouseChatComposer
                value={draft}
                onChange={setDraft}
                onSendText={sendText}
                onSendFile={sendFile}
                onSelectFiles={addPendingFiles}
                disabled={blocked}
                sending={sending}
                placeholder={blocked ? blockedReason : "Escribe un mensaje"}
              />
            </footer>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <ChatBubbleLeftRightIcon className="h-16 w-16 text-muted-foreground/40" />
            <p className="text-lg font-semibold text-muted-foreground">Busca un nuevo chat</p>
            <p className="text-sm text-muted-foreground/70">Selecciona una conversación para empezar</p>
          </div>
        )}
      </div>
      </div>
      <Dialog open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etiquetas de Envíos</DialogTitle>
            <DialogDescription>Clasifica esta conversación sin modificar las etiquetas del chat de Ventas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nombre de la etiqueta</label>
              <input value={newTagLabel} onChange={(event) => setNewTagLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createAndAssignTag() }} maxLength={80} placeholder="Ej: Urgente, Seguimiento..." className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Color</p>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => <button key={color} type="button" onClick={() => setNewTagColor(color)} className={cn("h-8 w-8 rounded-lg transition-transform", newTagColor === color ? "scale-110 ring-2 ring-foreground ring-offset-2" : "hover:scale-105")} style={{ backgroundColor: color }} aria-label={`Usar color ${color}`}>{newTagColor === color && <CheckIcon className="mx-auto h-4 w-4 text-white" />}</button>)}
              </div>
            </div>
            <Button type="button" onClick={() => void createAndAssignTag()} disabled={tagSaving || newTagLabel.trim().length < 2} className="w-full">
              {tagSaving ? "Guardando..." : "Crear y asignar"}
            </Button>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etiquetas disponibles</p>
              {tagsLoading ? <p className="text-sm text-muted-foreground">Cargando etiquetas...</p> : (
                <div className="flex flex-wrap gap-2">
                  {availableTags.filter((tag) => !selected?.tags?.some((activeTag) => activeTag.id === tag.id)).map((tag) => (
                    <button key={tag.id} type="button" onClick={() => void assignTag(tag.id)} disabled={tagSaving} className="rounded-full px-3 py-1 text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: tag.color }}>{tag.label}</button>
                  ))}
                  {!availableTags.some((tag) => !selected?.tags?.some((activeTag) => activeTag.id === tag.id)) && <span className="text-xs text-muted-foreground">No hay etiquetas pendientes de asignar.</span>}
                </div>
              )}
            </div>
            {selected?.tags?.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etiquetas actuales</p>
                <div className="flex flex-wrap gap-2">
                  {selected.tags.map((tag) => (
                    <span key={tag.id} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: tag.color }}>
                      {tag.label}
                      <button type="button" onClick={() => void removeTag(tag.id)} disabled={tagSaving} className="rounded-full p-0.5 hover:bg-black/15 disabled:opacity-50" aria-label={`Quitar ${tag.label}`}><XMarkIcon className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      {activeAttachment ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#0b141a] text-white" role="dialog" aria-modal="true" aria-label="Archivos para enviar">
          <input ref={previewFileInputRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(event) => { addPendingFiles(Array.from(event.target.files || [])); event.target.value = "" }} />
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-3 sm:px-5">
            <button type="button" onClick={closeAttachmentPreview} disabled={sending} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40" aria-label="Cerrar vista previa"><XMarkIcon className="h-6 w-6" /></button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-bold">{activeAttachment.file.name}</p>
              <p className="text-[10px] text-slate-400">{pendingAttachments.length} {pendingAttachments.length === 1 ? "archivo" : "archivos"}</p>
            </div>
            <span className="h-10 w-10" />
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
            {activeAttachment.file.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeAttachment.url} alt={activeAttachment.file.name} className="max-h-full max-w-full rounded-lg object-contain" />
            ) : activeAttachment.file.type.startsWith("video/") ? (
              <video src={activeAttachment.url} controls className="max-h-full max-w-full rounded-lg bg-black" />
            ) : (
              <div className="flex w-full max-w-sm flex-col items-center rounded-xl bg-white px-6 py-8 text-center text-slate-900 shadow-2xl">
                <DocumentIcon className="h-16 w-16 text-emerald-600" />
                <p className="mt-4 max-w-full break-all text-sm font-bold">{activeAttachment.file.name}</p>
                <p className="mt-1 text-xs text-slate-500">{fileSize(activeAttachment.file.size)}</p>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-[#111b21] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-lg bg-[#202c33] px-3 py-2">
              <input value={attachmentCaption} onChange={(event) => setAttachmentCaption(event.target.value)} placeholder="Escribe un mensaje" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" />
            </div>
            <div className="mx-auto mt-3 flex w-full max-w-2xl items-center gap-2 overflow-x-auto pb-1">
              {pendingAttachments.map((attachment) => (
                <div key={attachment.id} className="relative h-16 w-16 shrink-0">
                  <button type="button" onClick={() => setActiveAttachmentId(attachment.id)} className={cn("flex h-full w-full items-center justify-center overflow-hidden rounded-lg border-2 bg-[#202c33]", activeAttachment.id === attachment.id ? "border-emerald-500" : "border-transparent")} aria-label={`Ver ${attachment.file.name}`}>
                    {attachment.file.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                    ) : attachment.file.type.startsWith("video/") ? <video src={attachment.url} className="h-full w-full object-cover" /> : <DocumentIcon className="h-7 w-7 text-emerald-400" />}
                  </button>
                  <button type="button" onClick={() => removePendingFile(attachment.id)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white" aria-label={`Quitar ${attachment.file.name}`}><XMarkIcon className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => previewFileInputRef.current?.click()} disabled={sending} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-500 text-white hover:bg-white/10" aria-label="Agregar más archivos"><PlusIcon className="h-7 w-7" /></button>
              <button type="button" onClick={() => void sendPendingFiles()} disabled={sending || pendingAttachments.length === 0} className="ml-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[#111b21] shadow-lg hover:bg-emerald-400 disabled:opacity-50" aria-label="Enviar archivos">{sending ? <ArrowPathIcon className="h-6 w-6 animate-spin" /> : <PaperAirplaneIcon className="h-6 w-6" />}</button>
            </div>
          </footer>
        </div>
      ) : null}
    </section>
  )
}
