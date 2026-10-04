"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PhoneIcon,
  ShoppingBagIcon,
  TagIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { CrmClientForm, type CrmClientFormValue } from "@/components/crm/CrmClientForm"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/auth/auth-fetch"
import { normalizePeruvianMobile } from "@/lib/crm/phone"

type ContactFilter = "TODOS" | "CON_COMPRAS" | "SIN_COMPRAS" | "DATOS_INCOMPLETOS" | "CON_ETIQUETAS"

interface ClienteResumen {
  idCliente: number
  tipoDocumento: string | null
  nroDocumento: string | null
  nombres: string
  telefono: string | null
  correo: string | null
  direccion: string | null
}

interface CrmContactTag {
  id: number
  nombre: string
  color: string
}

interface CrmContact {
  idConversation: number
  conversationStatus: string | null
  lastMessage: string | null
  lastMessageType: string | null
  lastMessageAt: string | null
  cliente: ClienteResumen
  tags: CrmContactTag[]
  comprasEmitidas: number
  montoTotalComprado: number
  ultimaCompra: string | null
  datosIncompletos: boolean
  tieneCompras: boolean
  tieneEtiquetas: boolean
}

interface PagedResponse<T> {
  content: T[]
  page: number
  size: number
  totalPages: number
  totalElements: number
  numberOfElements: number
  first: boolean
  last: boolean
  empty: boolean
}

type ClienteForm = CrmClientFormValue

const FILTERS: Array<{ value: ContactFilter; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "CON_COMPRAS", label: "Con compras" },
  { value: "SIN_COMPRAS", label: "Sin compras" },
  { value: "DATOS_INCOMPLETOS", label: "Datos incompletos" },
  { value: "CON_ETIQUETAS", label: "Con etiquetas" },
]

const PAGE_SIZE = 12

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
})

function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Number(value ?? 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function lastMessagePreview(contact: CrmContact) {
  const type = (contact.lastMessageType ?? "").toUpperCase()
  if (type === "IMAGE") return "Imagen"
  if (type === "AUDIO") return "Audio"
  if (type === "VIDEO") return "Video"
  if (type === "DOCUMENT") return "Archivo"
  return contact.lastMessage?.trim() || "Sin mensajes"
}

function emptyForm(): ClienteForm {
  return {
    tipoDocumento: "SIN_DOC",
    nroDocumento: "",
    nombres: "",
    telefono: "",
    correo: "",
    direccion: "",
  }
}

function formFromContact(contact: CrmContact): ClienteForm {
  return {
    tipoDocumento: (contact.cliente.tipoDocumento as ClienteForm["tipoDocumento"]) ?? "SIN_DOC",
    nroDocumento: contact.cliente.nroDocumento ?? "",
    nombres: contact.cliente.nombres ?? "",
    telefono: normalizePeruvianMobile(contact.cliente.telefono),
    correo: contact.cliente.correo ?? "",
    direccion: contact.cliente.direccion ?? "",
  }
}

async function readApiMessage(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data.message === "string" ? data.message : fallback
  } catch {
    return fallback
  }
}

export default function ContactoPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [searchDraft, setSearchDraft] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ContactFilter>("TODOS")
  const [page, setPage] = useState(0)
  const [pagination, setPagination] = useState<PagedResponse<CrmContact> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null)
  const [detailContact, setDetailContact] = useState<CrmContact | null>(null)
  const [form, setForm] = useState<ClienteForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setQuery(searchDraft.trim())
      setPage(0)
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [searchDraft])

  const loadContacts = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        filter,
        page: String(page),
        size: String(PAGE_SIZE),
      })
      if (query) {
        params.set("q", query)
      }
      const response = await authFetch(`/api/crm/whatsapp/contacts?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudieron cargar los contactos"))
      }
      const data = (await response.json()) as PagedResponse<CrmContact>
      setPagination(data)
      setContacts(data.content ?? [])
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "No se pudieron cargar los contactos"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [filter, page, query])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContacts()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadContacts])

  const openEdit = (contact: CrmContact) => {
    setEditingContact(contact)
    setForm(formFromContact(contact))
  }

  const handleSaveClient = async () => {
    if (!editingContact || saving) return
    const telefono = normalizePeruvianMobile(form.telefono)
    if (!telefono) {
      toast.error("Ingresa un celular peruano valido de 9 digitos")
      return
    }
    const nombres = form.nombres.trim() || `CLIENTE ${telefono}`
    setSaving(true)
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${editingContact.idConversation}/client`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoDocumento: form.tipoDocumento,
          nroDocumento: form.tipoDocumento === "SIN_DOC" ? null : form.nroDocumento.trim(),
          nombres,
          telefono,
          correo: form.correo.trim() || null,
          direccion: form.direccion.trim() || null,
          estado: "ACTIVO",
        }),
      })

      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo actualizar el cliente"))
      }

      toast.success("Cliente actualizado")
      setEditingContact(null)
      await loadContacts()
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "No se pudo actualizar el cliente")
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChat = (contact: CrmContact) => {
    router.push(`/chat?conversationId=${contact.idConversation}`)
  }

  const changeFilter = (nextFilter: ContactFilter) => {
    setFilter(nextFilter)
    setPage(0)
  }

  const pageSummary = pagination
    ? `${pagination.totalElements} contacto${pagination.totalElements === 1 ? "" : "s"}`
    : "Contactos CRM"

  return (
    <div className="min-h-screen bg-slate-50 px-2 py-3 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:px-3 lg:px-4">
      <div className="flex w-full flex-col gap-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar por nombre, telefono, documento o correo"
                className="h-10 rounded-xl pl-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => changeFilter(item.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    filter === item.value
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadContacts()} />
        ) : contacts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
              <div className="grid grid-cols-[1.3fr_1fr_1fr_0.9fr_0.8fr] border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                <span>Cliente</span>
                <span>Etiquetas</span>
                <span>Compras</span>
                <span>Chat</span>
                <span className="text-right">Acciones</span>
              </div>
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.idConversation}
                  contact={contact}
                  onOpenChat={handleOpenChat}
                  onEdit={openEdit}
                  onShowSales={setDetailContact}
                />
              ))}
            </section>

            <section className="grid gap-3 md:hidden">
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.idConversation}
                  contact={contact}
                  onOpenChat={handleOpenChat}
                  onEdit={openEdit}
                  onShowSales={setDetailContact}
                />
              ))}
            </section>
          </>
        )}

        <footer className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>{pageSummary}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-xl"
              disabled={loading || page === 0 || Boolean(pagination?.first)}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Anterior
            </Button>
            <span className="min-w-24 text-center text-xs font-semibold uppercase tracking-[0.12em]">
              Pag. {page + 1} de {pagination?.totalPages ? pagination.totalPages : 1}
            </span>
            <Button
              variant="outline"
              className="h-9 rounded-xl"
              disabled={loading || Boolean(pagination?.last) || !pagination}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </div>
        </footer>
      </div>

      <Dialog open={Boolean(editingContact)} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-xl p-5 sm:max-w-md">
          <CrmClientForm
            value={form}
            onChange={setForm}
            onSubmit={(event) => {
              event.preventDefault()
              void handleSaveClient()
            }}
            title="Editar Cliente"
            description="Completa o corrige los datos del cliente."
            submitLabel="Guardar"
            saving={saving}
            onCancel={() => setEditingContact(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailContact)} onOpenChange={(open) => !open && setDetailContact(null)}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resumen de ventas</DialogTitle>
            <DialogDescription>
              Datos emitidos del cliente dentro del CRM.
            </DialogDescription>
          </DialogHeader>
          {detailContact && (
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cliente</p>
                <p className="mt-1 text-lg font-bold">{detailContact.cliente.nombres}</p>
                <p className="text-sm text-slate-500">{normalizePeruvianMobile(detailContact.cliente.telefono) || "Sin telefono"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Compras" value={String(detailContact.comprasEmitidas)} />
                <MetricCard label="Total" value={formatCurrency(detailContact.montoTotalComprado)} />
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ultima compra</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(detailContact.ultimaCompra)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}

function ContactRow({
  contact,
  onOpenChat,
  onEdit,
  onShowSales,
}: {
  contact: CrmContact
  onOpenChat: (contact: CrmContact) => void
  onEdit: (contact: CrmContact) => void
  onShowSales: (contact: CrmContact) => void
}) {
  return (
    <div className="grid grid-cols-[1.3fr_1fr_1fr_0.9fr_0.8fr] items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-0 dark:border-slate-800">
      <ContactIdentity contact={contact} />
      <TagList tags={contact.tags} incomplete={contact.datosIncompletos} />
      <SalesSummary contact={contact} />
      <ChatSummary contact={contact} />
      <ActionGroup contact={contact} onOpenChat={onOpenChat} onEdit={onEdit} onShowSales={onShowSales} alignEnd />
    </div>
  )
}

function ContactCard({
  contact,
  onOpenChat,
  onEdit,
  onShowSales,
}: {
  contact: CrmContact
  onOpenChat: (contact: CrmContact) => void
  onEdit: (contact: CrmContact) => void
  onShowSales: (contact: CrmContact) => void
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <ContactIdentity contact={contact} />
        <Badge className="rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {contact.conversationStatus ?? "CHAT"}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
        <SalesSummary contact={contact} />
        <ChatSummary contact={contact} />
        <TagList tags={contact.tags} incomplete={contact.datosIncompletos} />
      </div>
      <ActionGroup contact={contact} onOpenChat={onOpenChat} onEdit={onEdit} onShowSales={onShowSales} />
    </article>
  )
}

function ContactIdentity({ contact }: { contact: CrmContact }) {
  const phone = normalizePeruvianMobile(contact.cliente.telefono)
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <UserCircleIcon className="h-8 w-8 shrink-0 text-emerald-500" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950 dark:text-white">{contact.cliente.nombres}</p>
          <p className="truncate text-xs text-slate-500">{contact.cliente.nroDocumento || "SIN_DOC"}</p>
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <PhoneIcon className="h-3.5 w-3.5" />
          {phone || "Sin telefono"}
        </span>
        <span className="truncate">{contact.cliente.correo || "Sin correo"}</span>
      </div>
    </div>
  )
}

function TagList({ tags, incomplete }: { tags: CrmContactTag[]; incomplete: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {incomplete && (
        <Badge className="rounded-full bg-amber-50 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
          Incompleto
        </Badge>
      )}
      {tags.length === 0 ? (
        <span className="text-xs text-slate-400">Sin etiquetas</span>
      ) : tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
          style={{ backgroundColor: `${tag.color}1A`, color: tag.color }}
        >
          <TagIcon className="h-3 w-3" />
          {tag.nombre}
        </span>
      ))}
    </div>
  )
}

function SalesSummary({ contact }: { contact: CrmContact }) {
  return (
    <div className="min-w-0 text-sm">
      <p className="font-black text-slate-950 dark:text-white">{formatCurrency(contact.montoTotalComprado)}</p>
      <p className="text-xs text-slate-500">{contact.comprasEmitidas} compra{contact.comprasEmitidas === 1 ? "" : "s"}</p>
      <p className="mt-1 truncate text-xs text-slate-400">Ultima: {formatDate(contact.ultimaCompra)}</p>
    </div>
  )
}

function ChatSummary({ contact }: { contact: CrmContact }) {
  return (
    <div className="min-w-0">
      <Badge className="rounded-full bg-blue-50 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
        {contact.conversationStatus ?? "CHAT"}
      </Badge>
      <p className="mt-1 truncate text-xs text-slate-500">{lastMessagePreview(contact)}</p>
      <p className="text-xs text-slate-400">{formatDate(contact.lastMessageAt)}</p>
    </div>
  )
}

function ActionGroup({
  contact,
  onOpenChat,
  onEdit,
  onShowSales,
  alignEnd,
}: {
  contact: CrmContact
  onOpenChat: (contact: CrmContact) => void
  onEdit: (contact: CrmContact) => void
  onShowSales: (contact: CrmContact) => void
  alignEnd?: boolean
}) {
  return (
    <div className={cn("mt-3 flex flex-wrap gap-2 md:mt-0", alignEnd && "justify-end")}>
      <Button size="sm" className="h-8 gap-1 rounded-xl bg-blue-600 px-3 text-xs hover:bg-blue-700" onClick={() => onOpenChat(contact)}>
        <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
        Chat
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-xl px-3 text-xs" onClick={() => onEdit(contact)}>
        <PencilSquareIcon className="h-3.5 w-3.5" />
        Editar
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-xl px-3 text-xs" onClick={() => onShowSales(contact)}>
        <ShoppingBagIcon className="h-3.5 w-3.5" />
        Ventas
      </Button>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
      <p className="font-bold">No se pudo cargar contactos</p>
      <p className="mt-1 text-sm">{message}</p>
      <Button onClick={onRetry} className="mt-4 rounded-xl bg-rose-600 hover:bg-rose-700">
        Reintentar
      </Button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <CurrencyDollarIcon className="h-10 w-10 text-slate-300" />
      <p className="mt-3 text-lg font-black">Sin contactos encontrados</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Cuando un chat tenga cliente vinculado o creado desde WhatsApp CRM, aparecera aqui con sus compras y etiquetas.
      </p>
    </div>
  )
}
