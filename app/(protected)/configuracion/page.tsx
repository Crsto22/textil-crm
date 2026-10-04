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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const deleteWhatsappMessages = async () => {
    setDeleting(true)
    const toastId = toast.loading("Eliminando historial de WhatsApp...")
    try {
      const response = await authFetch("/api/crm/whatsapp/conversations", { method: "DELETE" })
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo eliminar el historial"))
      }
      const data = (await response.json()) as DeleteMessagesResponse
      toast.success(
        `Conversaciones eliminadas: ${data.deletedConversations ?? 0}. Mensajes: ${data.deletedMessages ?? 0}. Archivos: ${data.deletedMediaFiles ?? 0}.`,
        { id: toastId },
      )
      setConfirmOpen(false)
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

      <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm dark:border-red-500/25 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Eliminar historial de WhatsApp</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Borra todas las conversaciones, mensajes y archivos guardados del chat. No elimina ventas, clientes ni
                etiquetas maestras.
              </p>
            </div>
          </div>
          <Button variant="destructive" className="shrink-0" onClick={() => setConfirmOpen(true)}>
            <TrashIcon className="h-4 w-4" />
            Eliminar historial
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Eliminar todo el historial?</DialogTitle>
            <DialogDescription>
              Esta accion borra definitivamente las conversaciones, mensajes, imagenes, audios, videos y documentos del
              CRM. Las ventas, clientes y etiquetas maestras se conservaran.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
            Los chats desapareceran de la lista y no se podran recuperar desde el CRM.
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={deleting} onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void deleteWhatsappMessages()}>
              {deleting ? "Eliminando..." : "Si, eliminar historial"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
