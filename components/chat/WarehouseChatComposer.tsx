"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { EmojiStyle, SuggestionMode, Theme } from "emoji-picker-react"
import {
  ArrowPathIcon,
  DocumentPlusIcon,
  FaceSmileIcon,
  MicrophoneIcon,
  PauseIcon,
  PaperAirplaneIcon,
  PlayIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false })
const BARS = [12, 20, 15, 27, 18, 31, 13, 23, 29, 17, 25, 14, 30, 19, 26, 12, 22, 29, 16, 24, 13, 28, 18, 31, 15, 22, 27, 14]

type AudioPreview = { blob: Blob; url: string; duration: number; mime: string }

function secondsLabel(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`
}

export function WarehouseChatComposer({
  value,
  onChange,
  onSendText,
  onSendFile,
  onSelectFiles,
  disabled,
  sending,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  onSendText: () => Promise<void>
  onSendFile: (file: File) => Promise<void>
  onSelectFiles?: (files: File[]) => void
  disabled?: boolean
  sending?: boolean
  placeholder: string
}) {
  const { resolvedTheme } = useTheme()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedRef = useRef(0)
  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [preview, setPreview] = useState<AudioPreview | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setRecordingSeconds((Date.now() - startedRef.current) / 1000), 250)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(() => () => {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  function removePreview() {
    if (preview) URL.revokeObjectURL(preview.url)
    previewUrlRef.current = null
    setPreview(null)
    setPreviewPlaying(false)
    setPreviewProgress(0)
  }

  async function startRecording() {
    if (disabled || sending || typeof MediaRecorder === "undefined") return
    try {
      removePreview()
      setEmojiOpen(false)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const candidates = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"]
      const mime = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      startedRef.current = Date.now()
      setRecordingSeconds(0)
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.start(250)
      setRecording(true)
    } catch {
      window.alert("No se pudo acceder al micrófono. Revisa el permiso del navegador.")
    }
  }

  function stopRecording(mode: "preview" | "send" | "cancel") {
    const recorder = recorderRef.current
    if (!recorder) return
    const elapsed = Math.max(1, (Date.now() - startedRef.current) / 1000)
    recorder.onstop = () => {
      const mime = recorder.mimeType || "audio/webm"
      const blob = new Blob(chunksRef.current, { type: mime })
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      recorderRef.current = null
      setRecording(false)
      if (mode === "cancel") return
      if (mode === "send") { void sendAudio(blob, mime); return }
      const url = URL.createObjectURL(blob)
      previewUrlRef.current = url
      setPreview({ blob, url, duration: elapsed, mime })
    }
    recorder.stop()
  }

  async function sendAudio(blob: Blob, mime: string) {
    const extension = mime.includes("ogg") ? "ogg" : "webm"
    const file = new File([blob], `audio-${Date.now()}.${extension}`, { type: mime })
    await onSendFile(file)
    removePreview()
  }

  function insertEmoji(emoji: string) {
    const input = inputRef.current
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? value.length
    onChange(value.slice(0, start) + emoji + value.slice(end))
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + emoji.length, start + emoji.length) })
  }

  function resize(event: React.FormEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget
    target.style.height = "auto"
    target.style.height = `${Math.min(target.scrollHeight, 136)}px`
  }

  return (
    <>
      <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(event) => {
        const files = Array.from(event.target.files || [])
        if (onSelectFiles) onSelectFiles(files)
        else void (async () => { for (const file of files) await onSendFile(file) })()
        event.target.value = ""
      }} />
      <form className="relative z-10 flex min-h-14 items-end gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1 shadow-sm" onSubmit={(event) => { event.preventDefault(); if (value.trim()) void onSendText() }}>
        {recording ? (
          <>
            <button type="button" onClick={() => stopRecording("cancel")} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-red-500" aria-label="Cancelar grabación"><TrashIcon className="h-5 w-5" /></button>
            <div className="mb-1 flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-full bg-muted/70 px-4"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /><span className="text-sm font-semibold tabular-nums">{secondsLabel(recordingSeconds)}</span><div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">{BARS.map((height, index) => <span key={`${height}-${index}`} className="w-1 shrink-0 animate-pulse rounded-full bg-muted-foreground/70" style={{ height: Math.max(8, height - 4) }} />)}</div></div>
            <button type="button" onClick={() => stopRecording("preview")} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10" aria-label="Detener grabación"><PauseIcon className="h-5 w-5" /></button>
            <button type="button" onClick={() => stopRecording("send")} className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600" aria-label="Enviar audio"><PaperAirplaneIcon className="h-5 w-5" /></button>
          </>
        ) : preview ? (
          <>
            <button type="button" onClick={removePreview} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-red-500" aria-label="Eliminar audio"><TrashIcon className="h-5 w-5" /></button>
            <button type="button" onClick={() => { const audio = previewAudioRef.current; if (!audio) return; if (audio.paused) void audio.play(); else audio.pause() }} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white" aria-label={previewPlaying ? "Pausar audio" : "Reproducir audio"}>{previewPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}</button>
            <div className="mb-1 flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-full bg-muted/70 px-4"><audio ref={previewAudioRef} src={preview.url} className="hidden" onPlay={() => setPreviewPlaying(true)} onPause={() => setPreviewPlaying(false)} onEnded={() => setPreviewPlaying(false)} onTimeUpdate={(event) => setPreviewProgress(event.currentTarget.duration ? event.currentTarget.currentTime / event.currentTarget.duration * 100 : 0)} /><div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">{BARS.map((height, index) => <span key={`${height}-${index}`} className={cn("w-1 shrink-0 rounded-full", index / BARS.length * 100 <= previewProgress ? "bg-emerald-500" : "bg-muted-foreground/40")} style={{ height: Math.max(6, height - 8) }} />)}</div><span className="text-sm font-semibold tabular-nums">{secondsLabel(preview.duration)}</span></div>
            <button type="button" onClick={() => void startRecording()} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10" aria-label="Grabar de nuevo"><MicrophoneIcon className="h-5 w-5" /></button>
            <button type="button" disabled={sending} onClick={() => void sendAudio(preview.blob, preview.mime)} className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white disabled:opacity-50" aria-label="Enviar audio">{sending ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PaperAirplaneIcon className="h-5 w-5" />}</button>
          </>
        ) : (
          <>
            <div className="relative">
              <button type="button" onClick={() => setEmojiOpen((open) => !open)} disabled={disabled || sending} className="mb-1 flex h-9 w-7 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-40" aria-label="Abrir selector de emojis"><FaceSmileIcon className="h-5 w-5" /></button>
              {emojiOpen && <div className="absolute bottom-full left-0 z-50 mb-4 w-[min(352px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"><EmojiPicker onEmojiClick={(emoji) => insertEmoji(emoji.emoji)} width="100%" height={390} theme={resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT} emojiStyle={EmojiStyle.NATIVE} lazyLoadEmojis searchPlaceholder="Buscar emoji" previewConfig={{ showPreview: false }} suggestedEmojisMode={SuggestionMode.RECENT} className="!border-0" /></div>}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled || sending} className="mb-1 flex h-9 w-7 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:opacity-40" aria-label="Adjuntar archivo"><DocumentPlusIcon className="h-5 w-5" /></button>
            <textarea ref={inputRef} autoComplete="off" rows={1} value={value} onChange={(event) => onChange(event.target.value)} onInput={resize} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (value.trim()) void onSendText() } }} placeholder={placeholder} disabled={disabled || sending} className="sidebar-scroll max-h-[136px] min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent py-2 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50 md:text-sm" />
            <button type="button" disabled={disabled || sending} onClick={() => value.trim() ? void onSendText() : void startRecording()} className="mb-1 flex h-9 w-7 items-center justify-center text-foreground disabled:opacity-40" aria-label={value.trim() ? "Enviar mensaje" : "Grabar audio"}>{sending ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : value.trim() ? <PaperAirplaneIcon className="h-5 w-5" /> : <MicrophoneIcon className="h-5 w-5" />}</button>
          </>
        )}
      </form>
    </>
  )
}
