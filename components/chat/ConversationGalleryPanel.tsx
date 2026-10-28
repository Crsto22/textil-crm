"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  MusicalNoteIcon,
  PhotoIcon,
  PlayCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"

import { AuthenticatedImageThumbnail } from "@/components/chat/AuthenticatedImageThumbnail"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { authFetch } from "@/lib/auth/auth-fetch"

export interface GalleryItem {
  id: number
  messageType: string
  mimeType: string | null
  fileName: string | null
  description: string | null
  direction: string
  createdAt: string | null
  mediaUrl: string
}

export interface GalleryRealtimePayload {
  conversationId: string
  item: GalleryItem
}

interface GalleryPage {
  content: GalleryItem[]
  oldestId: number | null
  hasMoreBefore: boolean
}

interface GalleryCacheEntry extends GalleryPage {
  touchedAt: number
}

const PAGE_SIZE = 24
const MAX_CACHED_CONVERSATIONS = 8
const galleryCache = new Map<string, GalleryCacheEntry>()

function rememberGallery(conversationId: string, page: GalleryPage) {
  galleryCache.set(conversationId, { ...page, touchedAt: Date.now() })
  if (galleryCache.size <= MAX_CACHED_CONVERSATIONS) return
  const oldest = [...galleryCache.entries()].sort((left, right) => left[1].touchedAt - right[1].touchedAt)[0]?.[0]
  if (oldest) galleryCache.delete(oldest)
}

function dedupe(items: GalleryItem[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
    .sort((left, right) => right.id - left.id)
}

function mediaKind(item: GalleryItem) {
  const mime = item.mimeType?.toLowerCase() || ""
  const type = item.messageType?.toUpperCase() || ""
  if (type === "IMAGE" || type === "STICKER" || mime.startsWith("image/")) return "image"
  if (type === "VIDEO" || mime.startsWith("video/")) return "video"
  if (type === "AUDIO" || mime.startsWith("audio/")) return "audio"
  return "document"
}

function dateLabel(value: string | null) {
  if (!value) return "Fecha no disponible"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha no disponible"
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function useAuthenticatedMedia(source: string | null) {
  const [state, setState] = useState<{ source: string; url: string | null; loading: boolean; error: boolean } | null>(null)
  useEffect(() => {
    if (!source) return
    const controller = new AbortController()
    let objectUrl: string | null = null
    void authFetch(source, { cache: "force-cache", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo abrir el archivo")
        return response.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setState({ source, url: objectUrl, loading: false, error: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ source, url: null, loading: false, error: true })
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [source])
  if (!source) return null
  return state?.source === source ? state : { source, url: null, loading: true, error: false }
}

function AuthenticatedVideoThumbnail({ item }: { item: GalleryItem }) {
  const media = useAuthenticatedMedia(item.mediaUrl)
  return (
    <span className="relative block aspect-square overflow-hidden rounded-xl bg-slate-950">
      {media?.url ? <video src={media.url} muted preload="metadata" className="h-full w-full object-cover" /> : null}
      <span className="absolute inset-0 flex items-center justify-center bg-black/20">
        {media?.loading ? <ArrowPathIcon className="h-6 w-6 animate-spin text-white" /> : <PlayCircleIcon className="h-10 w-10 text-white drop-shadow" />}
      </span>
    </span>
  )
}

export function ConversationGalleryPanel({
  conversationId,
  realtimeMedia,
}: {
  conversationId: string
  realtimeMedia?: GalleryRealtimePayload | null
}) {
  const cached = galleryCache.get(conversationId)
  const [items, setItems] = useState<GalleryItem[]>(cached?.content ?? [])
  const [oldestId, setOldestId] = useState<number | null>(cached?.oldestId ?? null)
  const [hasMore, setHasMore] = useState(cached?.hasMoreBefore ?? true)
  const [loading, setLoading] = useState(!cached)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<GalleryItem | null>(null)
  const observerTargetRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const loadingRef = useRef(false)
  const stateRef = useRef({ items: cached?.content ?? [], oldestId: cached?.oldestId ?? null, hasMore: cached?.hasMoreBefore ?? true })
  const selectedMedia = useAuthenticatedMedia(selected?.mediaUrl ?? null)

  const applyPage = useCallback((page: GalleryPage, append: boolean) => {
    const content = dedupe(append ? [...stateRef.current.items, ...page.content] : page.content)
    stateRef.current = { items: content, oldestId: page.oldestId, hasMore: page.hasMoreBefore }
    setItems(content)
    setOldestId(page.oldestId)
    setHasMore(page.hasMoreBefore)
    rememberGallery(conversationId, { content, oldestId: page.oldestId, hasMoreBefore: page.hasMoreBefore })
  }, [conversationId])

  const loadPage = useCallback(async (append: boolean) => {
    if (loadingRef.current || append && !stateRef.current.hasMore) return
    loadingRef.current = true
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError("")
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (append && stateRef.current.oldestId != null) params.set("beforeId", String(stateRef.current.oldestId))
    try {
      const response = await authFetch(
        `/api/crm/whatsapp/conversations/${conversationId}/gallery?${params}`,
        { cache: "no-store", signal: controller.signal },
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message || "No se pudo cargar la galería")
      }
      if (!controller.signal.aborted) applyPage((await response.json()) as GalleryPage, append)
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la galería")
    } finally {
      if (!controller.signal.aborted) {
        loadingRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [applyPage, conversationId])

  useEffect(() => {
    const timer = galleryCache.has(conversationId)
      ? null
      : window.setTimeout(() => void loadPage(false), 0)
    return () => {
      if (timer != null) window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [conversationId, loadPage])

  useEffect(() => {
    if (!realtimeMedia || realtimeMedia.conversationId !== conversationId) return
    const content = dedupe([realtimeMedia.item, ...stateRef.current.items])
    stateRef.current = { ...stateRef.current, items: content }
    setItems(content)
    rememberGallery(conversationId, {
      content,
      oldestId: stateRef.current.oldestId,
      hasMoreBefore: stateRef.current.hasMore,
    })
  }, [conversationId, realtimeMedia])

  useEffect(() => {
    const target = observerTargetRef.current
    if (!target || !hasMore || loading || loadingMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadPage(true)
    }, { rootMargin: "240px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, loadPage, loading, loadingMore, oldestId])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Galería multimedia</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Imágenes, videos, audios y documentos del chat.</p>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-hidden p-3">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-square animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : error && items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <ExclamationTriangleIcon className="h-9 w-9 text-amber-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void loadPage(false)}>Reintentar</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
          <PhotoIcon className="h-12 w-12 opacity-40" />
          <div><p className="text-sm font-semibold text-foreground">Aún no hay archivos</p><p className="mt-1 text-xs">Los archivos compartidos aparecerán aquí.</p></div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => {
              const kind = mediaKind(item)
              return (
                <button key={item.id} type="button" onClick={() => setSelected(item)} className="group min-w-0 rounded-xl border border-border bg-background p-1.5 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md">
                  {kind === "image" ? (
                    <AuthenticatedImageThumbnail src={item.mediaUrl} alt={item.fileName || "Imagen del chat"} className="aspect-square rounded-lg" />
                  ) : kind === "video" ? (
                    <AuthenticatedVideoThumbnail item={item} />
                  ) : (
                    <span className="flex aspect-square items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      {kind === "audio" ? <MusicalNoteIcon className="h-10 w-10" /> : <DocumentIcon className="h-10 w-10" />}
                    </span>
                  )}
                  <span className="mt-1.5 block truncate px-0.5 text-[10px] font-semibold text-foreground">{item.fileName || item.description || "Archivo"}</span>
                  <span className="mt-0.5 block truncate px-0.5 text-[9px] text-muted-foreground">{item.direction === "INCOMING" ? "Recibido" : "Enviado"} · {dateLabel(item.createdAt)}</span>
                </button>
              )
            })}
          </div>
          <div ref={observerTargetRef} className="flex min-h-14 items-center justify-center py-3">
            {loadingMore ? <ArrowPathIcon className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
            {!hasMore ? <span className="text-[10px] text-muted-foreground">No hay más archivos</span> : null}
          </div>
          {error ? <div className="pb-3 text-center"><p className="mb-2 text-xs text-red-500">{error}</p><Button size="sm" variant="outline" onClick={() => void loadPage(true)}>Reintentar</Button></div> : null}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-4xl flex-col overflow-hidden p-0">
          <DialogTitle className="sr-only">Vista previa del archivo</DialogTitle>
          {selected ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{selected.fileName || "Archivo"}</p><p className="text-xs text-muted-foreground">{dateLabel(selected.createdAt)}</p></div>
                {selectedMedia?.url ? <a href={selectedMedia.url} download={selected.fileName || "archivo"} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted" aria-label="Descargar archivo"><ArrowDownTrayIcon className="h-5 w-5" /></a> : null}
                <button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted" aria-label="Cerrar"><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <div className="flex min-h-64 flex-1 items-center justify-center overflow-auto bg-black/95 p-4">
                {selectedMedia?.loading ? <ArrowPathIcon className="h-8 w-8 animate-spin text-white" /> : null}
                {selectedMedia?.error ? <p className="text-sm text-white">No se pudo abrir el archivo.</p> : null}
                {selectedMedia?.url && mediaKind(selected) === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated object URLs cannot use the Next image optimizer.
                  <img src={selectedMedia.url} alt={selected.fileName || "Imagen"} className="max-h-[76dvh] max-w-full object-contain" />
                ) : null}
                {selectedMedia?.url && mediaKind(selected) === "video" ? <video src={selectedMedia.url} controls autoPlay className="max-h-[76dvh] max-w-full" /> : null}
                {selectedMedia?.url && mediaKind(selected) === "audio" ? <audio src={selectedMedia.url} controls autoPlay className="w-full max-w-lg" /> : null}
                {selectedMedia?.url && mediaKind(selected) === "document" ? (
                  <div className="flex flex-col items-center gap-4 text-center text-white"><DocumentIcon className="h-20 w-20" /><p className="max-w-md break-all text-sm">{selected.fileName || "Documento"}</p><a href={selectedMedia.url} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">Abrir archivo</a></div>
                ) : null}
              </div>
              {selected.description && selected.description !== selected.fileName ? <p className="shrink-0 border-t border-border px-4 py-3 text-sm">{selected.description}</p> : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
