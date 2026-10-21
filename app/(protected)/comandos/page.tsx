"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BoltIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { AuthenticatedImageThumbnail } from "@/components/chat/AuthenticatedImageThumbnail"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { authFetch } from "@/lib/auth/auth-fetch"
import type { QuickMessage } from "@/lib/crm/quick-messages"
import { readQuickMessageApiError } from "@/lib/crm/quick-messages"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

interface DraftBlock {
  clientId: string
  id?: number
  type: "TEXT" | "IMAGE"
  body: string
  file?: File
  fileName?: string | null
  previewUrl?: string | null
}

const newTextBlock = (): DraftBlock => ({
  clientId: crypto.randomUUID(),
  type: "TEXT",
  body: "",
})

export default function ComandosPage() {
  const [commands, setCommands] = useState<QuickMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState("")
  const [blocks, setBlocks] = useState<DraftBlock[]>([newTextBlock()])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const loadCommands = useCallback(async () => {
    setLoading(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/quick-messages", { cache: "no-store" })
      if (!response.ok) throw new Error(await readQuickMessageApiError(response, "No se pudieron cargar los comandos"))
      setCommands((await response.json()) as QuickMessage[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los comandos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadCommands() }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadCommands])

  const filteredCommands = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^\//, "")
    return query ? commands.filter((command) => command.keyword.includes(query)) : commands
  }, [commands, search])

  const resetEditor = () => {
    blocks.forEach((block) => {
      if (block.file && block.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(block.previewUrl)
    })
    setEditingId(null)
    setKeyword("")
    setBlocks([newTextBlock()])
  }

  const openCreate = () => {
    resetEditor()
    setEditorOpen(true)
  }

  const openEdit = (command: QuickMessage) => {
    resetEditor()
    setEditingId(command.id)
    setKeyword(command.keyword)
    const savedTextBlocks = command.blocks.filter((block) => block.type === "TEXT")
    const textBlock: DraftBlock = {
      clientId: savedTextBlocks[0] ? `saved-${savedTextBlocks[0].id}` : crypto.randomUUID(),
      id: savedTextBlocks[0]?.id,
      type: "TEXT",
      body: savedTextBlocks.map((block) => block.body?.trim()).filter(Boolean).join("\n\n"),
    }
    const imageBlocks: DraftBlock[] = command.blocks
      .filter((block) => block.type === "IMAGE")
      .map((block) => ({
        clientId: `saved-${block.id}`,
        id: block.id,
        type: "IMAGE",
        body: "",
        fileName: block.fileName,
        previewUrl: block.mediaUrl,
      }))
    setBlocks([textBlock, ...imageBlocks])
    setEditorOpen(true)
  }

  const addImages = (files: FileList | null) => {
    if (!files?.length) return
    const next: DraftBlock[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} no es una imagen`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} supera el limite de 10 MB`)
        continue
      }
      next.push({
        clientId: crypto.randomUUID(),
        type: "IMAGE",
        body: "",
        file,
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      })
    }
    if (next.length) setBlocks((current) => [...current, ...next])
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const removeBlock = (clientId: string) => {
    setBlocks((current) => {
      const removed = current.find((block) => block.clientId === clientId)
      if (removed?.file && removed.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((block) => block.clientId !== clientId)
    })
  }

  const updateBlockBody = (clientId: string, body: string) => {
    setBlocks((current) => current.map((block) => block.clientId === clientId ? { ...block, body } : block))
  }

  const saveCommand = async () => {
    const normalizedKeyword = keyword.trim().toLowerCase().replace(/^\//, "")
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(normalizedKeyword)) {
      toast.error("Usa hasta 40 letras, numeros, guion o guion bajo")
      return
    }
    const textBlock = blocks.find((block) => block.type === "TEXT")
    if (!textBlock?.body.trim()) {
      toast.error("Escribe el texto del comando")
      return
    }
    const orderedBlocks = [textBlock, ...blocks.filter((block) => block.type === "IMAGE")]

    const formData = new FormData()
    formData.append("payload", JSON.stringify({
      keyword: normalizedKeyword,
      blocks: orderedBlocks.map((block) => ({ id: block.id ?? null, type: block.type, body: block.body.trim() })),
    }))
    orderedBlocks.forEach((block) => {
      if (block.type === "IMAGE" && !block.id && block.file) formData.append("files", block.file, block.file.name)
    })

    setSaving(true)
    try {
      const response = await authFetch(
        editingId ? `/api/crm/whatsapp/quick-messages/${editingId}` : "/api/crm/whatsapp/quick-messages",
        { method: editingId ? "PUT" : "POST", body: formData },
      )
      if (!response.ok) throw new Error(await readQuickMessageApiError(response, "No se pudo guardar el comando"))
      const saved = (await response.json()) as QuickMessage
      setCommands((current) => [...current.filter((command) => command.id !== saved.id), saved]
        .sort((left, right) => left.keyword.localeCompare(right.keyword)))
      toast.success(editingId ? "Comando actualizado" : "Comando creado")
      setEditorOpen(false)
      resetEditor()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el comando")
    } finally {
      setSaving(false)
    }
  }

  const deleteCommand = async (command: QuickMessage) => {
    if (!window.confirm(`¿Eliminar /${command.keyword}?`)) return
    setDeletingId(command.id)
    try {
      const response = await authFetch(`/api/crm/whatsapp/quick-messages/${command.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error(await readQuickMessageApiError(response, "No se pudo eliminar el comando"))
      setCommands((current) => current.filter((item) => item.id !== command.id))
      toast.success("Comando eliminado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el comando")
    } finally {
      setDeletingId(null)
    }
  }

  const editorTextBlock = blocks.find((block) => block.type === "TEXT")
  const editorImageBlocks = blocks.filter((block) => block.type === "IMAGE")

  return (
    <div className="-m-6 min-h-full space-y-5 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-xl font-bold text-foreground">Comandos y mensajes rapidos</h2>
        <Button onClick={openCreate} className="gap-2 rounded-xl">
          <PlusIcon className="h-4 w-4" /> Nuevo comando
        </Button>
      </div>

      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar /comando"
          className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-background p-10 text-center text-sm text-muted-foreground">Cargando comandos...</div>
      ) : filteredCommands.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-12 text-center">
          <BoltIcon className="mx-auto h-11 w-11 text-muted-foreground/50" />
          <h3 className="mt-3 font-semibold">{search ? "No encontramos comandos" : "Aun no hay comandos"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crea uno para responder mas rapido en tus conversaciones.</p>
          {!search && <Button onClick={openCreate} size="sm" className="mt-4">Crear comando</Button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCommands.map((command) => (
            <article key={command.id} className="group rounded-2xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-base font-bold text-blue-600 dark:text-blue-400">/{command.keyword}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{command.blocks.length} bloque{command.blocks.length === 1 ? "" : "s"} · Creado por {command.createdBy}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(command)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Editar /${command.keyword}`}>
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => void deleteCommand(command)} disabled={deletingId === command.id} className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50" aria-label={`Eliminar /${command.keyword}`}>
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {command.blocks.map((block, index) => (
                  <span key={block.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {block.type === "TEXT" ? <DocumentTextIcon className="h-3.5 w-3.5" /> : <PhotoIcon className="h-3.5 w-3.5" />}
                    {index + 1}. {block.type === "TEXT" ? "Texto" : "Imagen"}
                  </span>
                ))}
              </div>
              <button onClick={() => openEdit(command)} className="mt-4 w-full rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Ver y editar</button>
            </article>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) resetEditor() }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar comando" : "Nuevo comando"}</DialogTitle>
            <DialogDescription>Escribe el mensaje y agrega las imagenes que se enviaran despues.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Comando</label>
              <div className="flex h-11 items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-blue-500/30">
                <span className="font-mono font-bold text-blue-600">/</span>
                <input value={keyword} onChange={(event) => setKeyword(event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} maxLength={40} placeholder="preventa" className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm outline-none" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <DocumentTextIcon className="h-4 w-4 text-muted-foreground" /> Texto del mensaje
              </label>
              <textarea
                value={editorTextBlock?.body ?? ""}
                onChange={(event) => editorTextBlock && updateBlockBody(editorTextBlock.clientId, event.target.value)}
                maxLength={4000}
                rows={5}
                placeholder="Escribe el mensaje que recibira el cliente..."
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => addImages(event.target.files)} />
            <div className="rounded-2xl border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Imagenes</p>
                  <p className="text-xs text-muted-foreground">Se enviaran despues del texto.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => imageInputRef.current?.click()} className="gap-2">
                  <PhotoIcon className="h-4 w-4" /> Agregar imagenes
                </Button>
              </div>

              {editorImageBlocks.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {editorImageBlocks.map((block) => (
                    <div key={block.clientId} className="group/image min-w-0">
                      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                        <AuthenticatedImageThumbnail
                          src={block.previewUrl}
                          alt={block.fileName || "Imagen del comando"}
                          className="absolute inset-0"
                        />
                        <button
                          type="button"
                          onClick={() => removeBlock(block.clientId)}
                          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow-sm hover:bg-red-600"
                          aria-label={`Eliminar ${block.fileName || "imagen"}`}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 truncate px-0.5 text-[10px] text-muted-foreground" title={block.fileName || undefined}>
                        {block.fileName || "Imagen"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="mt-3 flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  <PhotoIcon className="h-5 w-5" /> Seleccionar imagenes
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveCommand()} disabled={saving || !editorTextBlock?.body.trim()}>{saving ? "Guardando..." : "Guardar comando"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
