"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckIcon,
  DocumentIcon,
  MicrophoneIcon,
  PauseIcon,
  PhotoIcon,
  PlayIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"

import { authFetch } from "@/lib/auth/auth-fetch"
import { cn } from "@/lib/utils"

export type WarehouseChatMessage = {
  id: number
  direction: "INCOMING" | "OUTGOING" | "SYSTEM"
  origin?: string | null
  messageType: string
  body: string
  status: string
  createdAt: string
  mediaMimeType?: string | null
  mediaFileName?: string | null
  mediaUrl?: string | null
  mediaDurationSeconds?: number | null
  relatedSaleId?: number | null
  receiptFormat?: string | null
  deleted: boolean
}

const WAVEFORM = [12, 20, 15, 27, 18, 31, 13, 23, 29, 17, 25, 14, 30, 19, 26, 12, 22, 29, 16, 24, 13, 28, 18, 31, 15, 22, 27, 14, 25, 18, 30, 16]

function chatTime(value?: string | null) {
  if (!value) return ""
  return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function duration(value: number) {
  const seconds = Math.max(0, Math.floor(value || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function useAuthenticatedBlobUrl(source?: string | null, enabled = true) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!source || !enabled) return
    if (source.startsWith("blob:")) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    void authFetch(source, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el archivo")
        return response.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
        setFailed(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attempt, enabled, source])

  return { url: source?.startsWith("blob:") ? source : url, failed, retry: () => setAttempt((value) => value + 1) }
}

function MessageStatusChecks({ status }: { status?: string }) {
  const normalized = status?.toLowerCase()
  if (normalized === "accepted" || normalized === "failed" || normalized === "deleted") return null
  if (normalized === "read") {
    return <span className="relative inline-flex w-4 text-sky-500"><CheckIcon className="h-3 w-3" /><CheckIcon className="-ml-1.5 h-3 w-3" /></span>
  }
  if (normalized === "delivered") {
    return <span className="relative inline-flex w-4"><CheckIcon className="whatsapp-outgoing-check h-3 w-3" /><CheckIcon className="whatsapp-outgoing-check -ml-1.5 h-3 w-3" /></span>
  }
  return <CheckIcon className="whatsapp-outgoing-check h-3 w-3" />
}

function AudioMessage({ message, outgoing }: { message: WarehouseChatMessage; outgoing: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [requested, setRequested] = useState(false)
  const media = useAuthenticatedBlobUrl(message.mediaUrl, requested)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [knownDuration, setKnownDuration] = useState(message.mediaDurationSeconds || 0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const update = () => {
      if (Number.isFinite(audio.duration)) setKnownDuration(audio.duration)
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
    }
    const ended = () => { setPlaying(false); setProgress(0) }
    audio.addEventListener("timeupdate", update)
    audio.addEventListener("loadedmetadata", update)
    audio.addEventListener("ended", ended)
    return () => {
      audio.removeEventListener("timeupdate", update)
      audio.removeEventListener("loadedmetadata", update)
      audio.removeEventListener("ended", ended)
    }
  }, [media.url])

  useEffect(() => {
    if (media.url && playing) void audioRef.current?.play().catch(() => setPlaying(false))
  }, [media.url, playing])

  function toggle() {
    if (!requested) { setRequested(true); setPlaying(true); return }
    const audio = audioRef.current
    if (!audio || !media.url) return
    if (audio.paused) { void audio.play(); setPlaying(true) } else { audio.pause(); setPlaying(false) }
  }

  return (
    <div className={cn("w-fit max-w-[88%] rounded-md px-3 py-3 text-sm shadow-sm md:max-w-[55%] md:min-w-[330px]", outgoing ? "whatsapp-outgoing-bubble ml-auto" : "mr-auto border border-border bg-card text-card-foreground")}>
      <audio ref={audioRef} src={media.url} preload="none" />
      <div className="flex items-center gap-3">
        {outgoing && <div className="relative h-10 w-10 shrink-0"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10"><UserIcon className="h-5 w-5" /></span><span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><MicrophoneIcon className="h-3 w-3" /></span></div>}
        <button type="button" onClick={toggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-emerald-600 hover:bg-black/5" aria-label={playing ? "Pausar audio" : "Reproducir audio"}>
          {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
        </button>
        <div className="relative h-9 min-w-0 flex-1 overflow-hidden">
          {WAVEFORM.map((height, index) => <span key={`${height}-${index}`} className="absolute bottom-0 w-0.5 rounded-full md:w-1" style={{ height, left: `${index / WAVEFORM.length * 100}%`, backgroundColor: index / WAVEFORM.length * 100 <= progress ? "rgb(16 185 129)" : "rgba(100,116,139,.4)" }} />)}
        </div>
        <span className="w-10 text-right text-xs font-medium">{knownDuration ? duration(knownDuration) : "--:--"}</span>
      </div>
      {media.failed && <button type="button" onClick={media.retry} className="mt-2 flex items-center gap-1 text-xs text-red-500"><ArrowPathIcon className="h-3.5 w-3.5" /> Reintentar</button>}
      <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", outgoing ? "whatsapp-outgoing-meta" : "text-muted-foreground")}>{chatTime(message.createdAt)} {outgoing && <MessageStatusChecks status={message.status} />}</p>
    </div>
  )
}

export function WarehouseMessageBubble({ message }: { message: WarehouseChatMessage }) {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const outgoing = message.direction === "OUTGOING"
  const isSystem = message.direction === "SYSTEM" || message.messageType === "SYSTEM"
  const mime = message.mediaMimeType?.toLowerCase() || ""
  const filename = message.mediaFileName || message.body || "Archivo"
  const isAudio = message.messageType === "AUDIO" || mime.startsWith("audio/")
  const isImage = message.messageType === "IMAGE" || mime.startsWith("image/")
  const isVideo = message.messageType === "VIDEO" || mime.startsWith("video/")
  const media = useAuthenticatedBlobUrl(message.mediaUrl, Boolean(message.mediaUrl && !isAudio))

  useEffect(() => {
    if (!imagePreviewOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImagePreviewOpen(false)
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [imagePreviewOpen])

  async function openReceipt(format: "pdf" | "ticket") {
    if (!message.relatedSaleId) return
    const response = await authFetch(`/api/venta/${message.relatedSaleId}/comprobante/${format}`, { cache: "no-store" })
    if (!response.ok) return
    const blobUrl = URL.createObjectURL(await response.blob())
    window.open(blobUrl, "_blank", "noopener,noreferrer")
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  }

  if (isSystem) {
    return (
      <div className="mx-auto w-fit max-w-[92%] rounded-lg border border-border bg-muted px-4 py-2 text-center text-xs font-bold text-foreground shadow-sm md:max-w-[70%]">
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.relatedSaleId && /compra/i.test(message.body || "") && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <button type="button" onClick={() => void openReceipt("pdf")} className="inline-flex h-7 items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 text-[10px] font-bold text-red-600 hover:bg-red-500/20 dark:text-red-200"><DocumentIcon className="h-3.5 w-3.5" /> PDF</button>
            <button type="button" onClick={() => void openReceipt("ticket")} className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-200"><DocumentIcon className="h-3.5 w-3.5" /> TICKET</button>
          </div>
        )}
        <p className="mt-1 text-[10px] font-normal text-muted-foreground">{chatTime(message.createdAt)}</p>
      </div>
    )
  }

  if (isAudio) return <AudioMessage message={message} outgoing={outgoing} />

  return <>
    <div className={cn("w-fit max-w-[88%] rounded-md text-sm shadow-sm md:max-w-[55%]", outgoing ? "whatsapp-outgoing-bubble ml-auto" : "mr-auto bg-card text-card-foreground", message.mediaUrl ? "p-1.5" : "px-3 py-3")}>
      {message.deleted ? (
        <p className="px-1 py-1 italic text-muted-foreground">Mensaje eliminado</p>
      ) : isImage && message.mediaUrl ? (
        media.url ? <button type="button" onClick={() => setImagePreviewOpen(true)} className="block cursor-zoom-in" aria-label={`Ver imagen ${filename}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.url} alt={filename} className="max-h-80 w-[min(72vw,340px)] rounded object-cover" />
        </button> : <div className="flex h-52 w-[min(72vw,340px)] items-center justify-center rounded bg-muted"><PhotoIcon className="h-8 w-8 animate-pulse text-muted-foreground" /></div>
      ) : isVideo && message.mediaUrl ? (
        media.url ? <video src={media.url} controls playsInline preload="metadata" className="max-h-80 w-[min(76vw,360px)] rounded bg-black" /> : <div className="h-48 w-[min(76vw,360px)] animate-pulse rounded bg-muted" />
      ) : message.mediaUrl ? (
        <button type="button" onClick={() => media.url && window.open(media.url, "_blank", "noopener,noreferrer")} className="flex w-[min(76vw,330px)] items-center gap-3 rounded bg-black/10 px-3 py-3 text-left dark:bg-white/10">
          <DocumentIcon className="h-9 w-9 shrink-0" /><span className="min-w-0 flex-1 break-all font-semibold">{filename}</span><ArrowDownTrayIcon className="h-5 w-5 shrink-0" />
        </button>
      ) : null}
      {message.body && message.body !== message.mediaFileName && !message.deleted && <p className={cn("whitespace-pre-wrap break-words leading-relaxed", message.mediaUrl && "px-1 pt-2")}>{message.body}</p>}
      {media.failed && <button type="button" onClick={media.retry} className="m-2 flex items-center gap-1 text-xs text-red-500"><ArrowPathIcon className="h-3.5 w-3.5" /> Reintentar</button>}
      <p className={cn("mt-1 flex items-center justify-end gap-1 px-1 text-[10px]", outgoing ? "whatsapp-outgoing-meta" : "text-muted-foreground")}>{chatTime(message.createdAt)} {outgoing && <MessageStatusChecks status={message.status} />}</p>
    </div>
    {imagePreviewOpen && media.url && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-[300] flex flex-col bg-[#f7f5f2] text-slate-900 dark:bg-black dark:text-white" role="dialog" aria-modal="true" aria-label={filename}>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 px-4 dark:border-white/10">
          <button type="button" onClick={() => setImagePreviewOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Cerrar imagen"><XMarkIcon className="h-6 w-6" /></button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{filename}</p>
          <a href={media.url} download={filename} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" aria-label={`Descargar ${filename}`}><ArrowDownTrayIcon className="h-5 w-5" /></a>
        </header>
        <div role="img" aria-label={filename} className="min-h-0 flex-1 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${media.url}")` }} />
      </div>,
      document.body,
    ) : null}
  </>
}
