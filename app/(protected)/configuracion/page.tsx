"use client"

import { useState } from "react"
import { ExclamationTriangleIcon, TrashIcon } from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authFetch } from "@/lib/auth/auth-fetch"

type DeleteMessagesResponse = {
  deletedMessages?: number
  deletedConversations?: number
  deletedTagAssignments?: number
  deletedMediaFiles?: number
}

async function readApiMessage(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.message === "string" ? data.message : fallback
  } catch {
    return fallback
  }
}

export default function ConfiguracionPage() {
  const [selectedArea, setSelectedArea] = useState<"SALES" | "SHIPPING" | null>(null)
  const [deleting, setDeleting] = useState(false)

  const deleteWhatsappMessages = async () => {
    if (!selectedArea) return
    setDeleting(true)
    const areaLabel = selectedArea === "SALES" ? "Ventas" : "Envíos"
    const toastId = toast.loading(`Eliminando chats de ${areaLabel}...`)
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations?area=${selectedArea}`, { method: "DELETE" })
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo eliminar el historial"))
      }
      const data = (await response.json()) as DeleteMessagesResponse
      toast.success(
        `Conversaciones eliminadas: ${data.deletedConversations ?? 0}. Mensajes: ${data.deletedMessages ?? 0}. Archivos: ${data.deletedMediaFiles ?? 0}.`,
        { id: toastId },
      )
      setSelectedArea(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el historial", { id: toastId })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          Kiments CRM
        </span>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Configuracion</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Mantenimiento de datos y canales del CRM.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm dark:border-red-500/25 dark:bg-white/[0.03]">
          <div className="flex h-full flex-col gap-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Eliminar chats de Ventas</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Borra las conversaciones, mensajes y archivos del canal de Ventas. No elimina ventas ni clientes.
              </p>
            </div>
          </div>
          <Button variant="destructive" className="mt-auto w-full" onClick={() => setSelectedArea("SALES")}>
            <TrashIcon className="h-4 w-4" />
            Eliminar chats de Ventas
          </Button>
        </div>
        </div>

        <div className="rounded-lg border border-orange-200 bg-white p-5 shadow-sm dark:border-orange-500/25 dark:bg-white/[0.03]">
          <div className="flex h-full flex-col gap-4">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300"><ExclamationTriangleIcon className="h-5 w-5" /></span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Eliminar chats de Envíos</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Borra las conversaciones, mensajes y archivos del canal de Envíos. No elimina pedidos ni ventas.</p>
              </div>
            </div>
            <Button variant="destructive" className="mt-auto w-full" onClick={() => setSelectedArea("SHIPPING")}><TrashIcon className="h-4 w-4" />Eliminar chats de Envíos</Button>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedArea)} onOpenChange={(open) => { if (!open && !deleting) setSelectedArea(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>¿Eliminar chats de {selectedArea === "SALES" ? "Ventas" : "Envíos"}?</DialogTitle>
            <DialogDescription>
              Esta acción borra definitivamente las conversaciones, mensajes, imágenes, audios, videos y documentos de este canal.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
            Los chats desapareceran de la lista y no se podran recuperar desde el CRM.
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={deleting} onClick={() => setSelectedArea(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void deleteWhatsappMessages()}>
              {deleting ? "Eliminando..." : `Sí, eliminar chats de ${selectedArea === "SALES" ? "Ventas" : "Envíos"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
