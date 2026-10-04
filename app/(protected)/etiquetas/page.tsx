"use client"

import { useCallback, useEffect, useState } from "react"
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  TagIcon,
} from "@heroicons/react/24/outline"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { authFetch } from "@/lib/auth/auth-fetch"
import { toast } from "sonner"

interface EtiquetaItem {
  id: string
  name: string
  color: string
  uso: number
}

interface CrmTagResponse {
  id: number
  nombre: string
  color: string
  uso: number
}

const TAG_COLORS = [
  { value: "#3b82f6", label: "Azul" },
  { value: "#22c55e", label: "Verde" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#eab308", label: "Amarillo" },
  { value: "#a855f7", label: "Morado" },
  { value: "#f97316", label: "Naranja" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#14b8a6", label: "Turquesa" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#78716c", label: "Piedra" },
]

const mapTag = (tag: CrmTagResponse): EtiquetaItem => ({
  id: String(tag.id),
  name: tag.nombre,
  color: tag.color,
  uso: tag.uso,
})

async function readApiMessage(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data.message === "string" ? data.message : fallback
  } catch {
    return fallback
  }
}

export default function EtiquetasPage() {
  const [etiquetas, setEtiquetas] = useState<EtiquetaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", color: TAG_COLORS[0].value })

  const loadEtiquetas = useCallback(async () => {
    setLoading(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/tags", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudieron cargar las etiquetas"))
      }
      const data = (await response.json()) as CrmTagResponse[]
      setEtiquetas(data.map(mapTag))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar las etiquetas")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEtiquetas()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadEtiquetas])

  const resetForm = () => {
    setForm({ name: "", color: TAG_COLORS[0].value })
    setEditingId(null)
  }

  const openAdd = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEdit = (etiqueta: EtiquetaItem) => {
    setForm({ name: etiqueta.name, color: etiqueta.color })
    setEditingId(etiqueta.id)
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Ingresa un nombre para la etiqueta")
      return
    }

    setSaving(true)
    try {
      const response = await authFetch(
        editingId ? `/api/crm/whatsapp/tags/${editingId}` : "/api/crm/whatsapp/tags",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: form.name.trim(), color: form.color }),
        },
      )
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo guardar la etiqueta"))
      }
      const saved = mapTag((await response.json()) as CrmTagResponse)
      setEtiquetas((current) =>
        editingId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
      )
      toast.success(editingId ? "Etiqueta actualizada" : "Etiqueta creada")
      setIsModalOpen(false)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la etiqueta")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const response = await authFetch(`/api/crm/whatsapp/tags/${id}`, { method: "DELETE" })
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo eliminar la etiqueta"))
      }
      setEtiquetas((current) => current.filter((item) => item.id !== id))
      toast.success("Etiqueta eliminada")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la etiqueta")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Etiquetas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea y gestiona etiquetas para organizar tus conversaciones
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
        >
          <PlusIcon className="h-4 w-4" />
          Nueva Etiqueta
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Cargando etiquetas...
        </div>
      ) : etiquetas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
          <TagIcon className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">Aun no tienes etiquetas</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crea la primera para usarla en los chats.</p>
          <Button onClick={openAdd} size="sm" className="mt-4">
            Crear etiqueta
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {etiquetas.map((etiqueta) => (
            <div
              key={etiqueta.id}
              className="group rounded-2xl border border-border bg-background p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                    style={{ backgroundColor: etiqueta.color }}
                  >
                    <TagIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: etiqueta.color }}
                      />
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {etiqueta.name}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {etiqueta.uso} conversaciones
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(etiqueta)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Editar"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void handleDelete(etiqueta.id)}
                    disabled={deletingId === etiqueta.id}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-500/10"
                    title="Eliminar"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <span
                  className="inline-flex max-w-full items-center truncate rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: etiqueta.color }}
                >
                  {etiqueta.name}
                </span>
              </div>
            </div>
          ))}

          <button
            onClick={openAdd}
            className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-all hover:border-muted-foreground/50 hover:text-foreground"
          >
            <PlusIcon className="h-8 w-8" />
            <span className="text-sm font-medium">Nueva Etiqueta</span>
          </button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Etiqueta" : "Nueva Etiqueta"}</DialogTitle>
            <DialogDescription>
              Crea una etiqueta para clasificar conversaciones
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Nombre
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave() }}
                placeholder="Ej: VIP, Urgente, Seguimiento..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-muted-foreground/20"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Color
              </label>
              <div className="grid grid-cols-5 gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: color.value }))}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                      form.color === color.value
                        ? "scale-110 ring-2 ring-foreground ring-offset-2"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  >
                    {form.color === color.value && (
                      <TagIcon className="h-5 w-5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Vista previa</p>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: form.color }}
              >
                {form.name || "Etiqueta"}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setIsModalOpen(false); resetForm() }}
              size="sm"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              size="sm"
              disabled={saving || !form.name.trim()}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {saving ? "Guardando..." : editingId ? "Guardar" : "Crear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
