"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowPathIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UserPlusIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CrmClientForm } from "@/components/crm/CrmClientForm"
import { authFetch } from "@/lib/auth/auth-fetch"
import { isValidPeruvianMobile, normalizePeruvianMobile } from "@/lib/crm/phone"
import { CrmQuickSalePanelFlow } from "@/components/chat/CrmQuickSalePanelFlow"

type TipoDocumento = "SIN_DOC" | "DNI" | "RUC" | "CE"

interface ClienteResumen {
  idCliente: number
  tipoDocumento: string | null
  nroDocumento: string | null
  nombres: string
  telefono: string | null
  correo: string | null
  direccion: string | null
}

interface SucursalResumen {
  idSucursal: number
  nombreSucursal: string
  tipoSucursal: string | null
}

interface ComprobanteResumen {
  idComprobante: number
  tipoComprobante: string
  serie: string
  siguienteCorrelativo: number
}

interface QuickSaleContext {
  conversationId: number
  contactName: string | null
  contactPhone: string | null
  cliente: ClienteResumen | null
  sucursales: SucursalResumen[]
  comprobantes: ComprobanteResumen[]
}

interface ChatSidebarProps {
  conversationId: string
  clientPhone: string
  contactName?: string | null
  aiAttending?: boolean
  onClose: () => void
  onSaleCompleted?: () => void
  onClientUpdated?: () => void
}

const emptyRegisterForm = {
  tipoDocumento: "SIN_DOC" as TipoDocumento,
  nroDocumento: "",
  nombres: "",
  telefono: "",
  correo: "",
  direccion: "",
}

function comprobanteLabel(item: ComprobanteResumen) {
  return `${item.tipoComprobante} ${item.serie}`
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null)
  return data?.message || data?.detail || data?.error || fallback
}

export function ChatSidebar({ conversationId, clientPhone, contactName, aiAttending = false, onClose, onSaleCompleted, onClientUpdated }: ChatSidebarProps) {
  const router = useRouter()
  const [context, setContext] = useState<QuickSaleContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null)
  const [selectedComprobanteId, setSelectedComprobanteId] = useState<number | null>(null)
  const [comprobanteSearch, setComprobanteSearch] = useState("")
  const [comprobanteSheetOpen, setComprobanteSheetOpen] = useState(false)
  const [sheetSearchComprobante, setSheetSearchComprobante] = useState("")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [, setSaleHasDraft] = useState(false)
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm)
  const [saving, setSaving] = useState(false)
  const [isMobileDrawer, setIsMobileDrawer] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const visibleContactPhone = normalizePeruvianMobile(context?.cliente?.telefono || context?.contactPhone || clientPhone)
  const visibleContactName = context?.cliente?.nombres || contactName || context?.contactName || visibleContactPhone || "Cliente sin registrar"
  const needsBranchConfiguration = error?.toLowerCase().includes("sucursal de venta") ?? false

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)")
    const update = () => setIsMobileDrawer(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  const loadContext = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/quick-sale`, {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(await readError(response, "No se pudo cargar venta rapida"))
      const data = (await response.json()) as QuickSaleContext
      if (controller.signal.aborted) return
      setContext(data)
      setSelectedSucursalId(data.sucursales[0]?.idSucursal ?? null)
      setSelectedComprobanteId((current) => current ?? data.comprobantes[0]?.idComprobante ?? null)
      setRegisterForm({
        ...emptyRegisterForm,
        nombres: data.contactName || contactName || "",
        telefono: normalizePeruvianMobile(data.contactPhone || clientPhone),
      })
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return
      setError(requestError instanceof Error ? requestError.message : "Error inesperado")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [clientPhone, contactName, conversationId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadContext(), 0)
    return () => {
      window.clearTimeout(timeoutId)
      abortRef.current?.abort()
    }
  }, [loadContext])

  const selectedComprobante = useMemo(
    () => context?.comprobantes.find((item) => item.idComprobante === selectedComprobanteId) ?? null,
    [context?.comprobantes, selectedComprobanteId],
  )

  const selectedSucursal = useMemo(
    () => context?.sucursales.find((item) => item.idSucursal === selectedSucursalId) ?? null,
    [context?.sucursales, selectedSucursalId],
  )

  const comprobanteOptions = useMemo<ComboboxOption[]>(
    () =>
      (context?.comprobantes ?? []).map((item) => ({
        value: String(item.idComprobante),
        label: comprobanteLabel(item),
        description: `Siguiente: ${item.siguienteCorrelativo}`,
      })),
    [context?.comprobantes],
  )

  const selectedComprobanteValue = selectedComprobanteId ? String(selectedComprobanteId) : ""

  const filterOptions = useCallback(
    (options: ComboboxOption[], query: string, selectedValue: string) => {
      const lowerQuery = query.trim().toLowerCase()
      const filtered = lowerQuery
        ? options.filter((option) =>
            `${option.label} ${option.description ?? ""}`.toLowerCase().includes(lowerQuery),
          )
        : options

      if (!selectedValue || filtered.some((option) => option.value === selectedValue)) {
        return filtered
      }

      const selected = options.find((option) => option.value === selectedValue)
      return selected ? [selected, ...filtered] : filtered
    },
    [],
  )

  const filteredComprobanteOptions = useMemo(
    () => filterOptions(comprobanteOptions, comprobanteSearch, selectedComprobanteValue),
    [comprobanteOptions, comprobanteSearch, filterOptions, selectedComprobanteValue],
  )

  const filteredComprobanteSheetOptions = useMemo(
    () => filterOptions(comprobanteOptions, sheetSearchComprobante, selectedComprobanteValue),
    [comprobanteOptions, filterOptions, selectedComprobanteValue, sheetSearchComprobante],
  )

  const currentSucursalDisplayName =
    selectedSucursal?.nombreSucursal || context?.sucursales[0]?.nombreSucursal || "Sin sucursal"
  const currentComprobanteDisplayName = selectedComprobante
    ? comprobanteLabel(selectedComprobante)
    : context?.comprobantes.length
      ? "Selecciona comprobante"
      : "Sin comprobante"

  const handleComprobanteChange = useCallback((value: string) => {
    const nextValue = Number(value)
    setSelectedComprobanteId(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : null)
  }, [])

  const isEditingClient = Boolean(context?.cliente)

  const resetRegisterModal = () => {
    if (context?.cliente) {
      setRegisterForm({
        tipoDocumento: (context.cliente.tipoDocumento as TipoDocumento | null) || "SIN_DOC",
        nroDocumento: context.cliente.nroDocumento || "",
        nombres: context.cliente.nombres || "",
        telefono: normalizePeruvianMobile(context.cliente.telefono || context.contactPhone || clientPhone),
        correo: context.cliente.correo || "",
        direccion: context.cliente.direccion || "",
      })
      return
    }
    const phone = context?.contactPhone || clientPhone
    setRegisterForm({
      ...emptyRegisterForm,
      nombres: context?.contactName || contactName || "",
      telefono: normalizePeruvianMobile(phone),
    })
  }

  const handleRegisterOpenChange = (open: boolean) => {
    setRegisterOpen(open)
    if (open) {
      resetRegisterModal()
      return
    }
  }

  const registerClient = async (event: FormEvent) => {
    event.preventDefault()
    const telefono = normalizePeruvianMobile(registerForm.telefono)
    if (!telefono) {
      toast.error("Registra un celular peruano valido de 9 digitos")
      return
    }
    setSaving(true)
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/client-register`, {
        method: "POST",
        body: JSON.stringify({
          ...registerForm,
          telefono,
          nombres: registerForm.nombres.trim() || `CLIENTE ${telefono}`,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, "No se pudo registrar cliente"))
      setContext((await response.json()) as QuickSaleContext)
      setRegisterOpen(false)
      onClientUpdated?.()
      toast.success("Cliente sincronizado")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Error al registrar")
    } finally {
      setSaving(false)
    }
  }

  const updateClient = async (event: FormEvent) => {
    event.preventDefault()
    const telefono = normalizePeruvianMobile(registerForm.telefono)
    if (!telefono) {
      toast.error("Registra un celular peruano valido de 9 digitos")
      return
    }
    setSaving(true)
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/client`, {
        method: "PUT",
        body: JSON.stringify({
          ...registerForm,
          telefono,
          nombres: registerForm.nombres.trim() || `CLIENTE ${telefono}`,
          estado: "ACTIVO",
        }),
      })
      if (!response.ok) throw new Error(await readError(response, "No se pudo actualizar cliente"))
      setContext((await response.json()) as QuickSaleContext)
      setRegisterOpen(false)
      onClientUpdated?.()
      toast.success("Cliente actualizado")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Error al actualizar")
    } finally {
      setSaving(false)
    }
  }

  const handleSaleCompleted = (nextContext: QuickSaleContext) => {
    setContext(nextContext)
    setSaleHasDraft(false)
    onClientUpdated?.()
    onSaleCompleted?.()
  }

  const registerClientForm = (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-5 pt-3">
      {isEditingClient ? (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
          Edita los datos del cliente. El celular se utiliza para mantenerlo sincronizado con el chat.
        </section>
      ) : null}
      <CrmClientForm
        value={registerForm}
        onChange={setRegisterForm}
        onSubmit={isEditingClient ? updateClient : registerClient}
        title={isEditingClient ? "Editar Cliente" : "Nuevo Cliente"}
        description={isEditingClient
          ? "Actualiza los datos del cliente."
          : "Ingresa el celular. Si ya existe, sus datos se sincronizaran automaticamente."}
        submitLabel="Guardar"
        saving={saving}
        submitDisabled={!isValidPeruvianMobile(registerForm.telefono)}
        onCancel={() => handleRegisterOpenChange(false)}
      />
    </div>
  )

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-1.5 py-1">
        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-sm">
          <ShoppingBagIcon className="h-3.5 w-3.5" />
          Venta Rapida
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Cerrar panel">
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 shadow-sm">
          <UserIcon className="h-4 w-4 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</p>
            <p className="truncate text-[11px] font-semibold text-foreground">{visibleContactName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{visibleContactPhone || "Teléfono pendiente"}</p>
          </div>
          <button
            type="button"
            onClick={() => handleRegisterOpenChange(true)}
            disabled={aiAttending}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:disabled:hover:bg-slate-900"
            aria-label={context?.cliente ? "Editar cliente" : "Registrar cliente"}
            title={aiAttending ? "Kiments IA atiende este chat. Cambia a atención humana para registrar al cliente." : context?.cliente ? "Editar cliente" : "Registrar cliente"}
          >
            <UserPlusIcon className="h-3.5 w-3.5" />
          </button>
          {!context?.cliente ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              Nuevo
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
          Cargando...
        </div>
      ) : error ? (
        <div className="m-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
          {needsBranchConfiguration ? (
            <Button
              className="mt-3 h-8 w-full text-xs"
              variant="outline"
              onClick={() => router.push("/conexiones")}
            >
              Configurar sucursal
            </Button>
          ) : (
            <Button className="mt-3 h-8 w-full text-xs" variant="outline" onClick={() => void loadContext()}>Reintentar</Button>
          )}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 py-2">
          <div className="flex shrink-0 items-center justify-between py-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Panel de Venta
            </h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              CRM
            </span>
          </div>

          <section className="grid grid-cols-2 gap-2 sm:hidden">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80">
              <BuildingStorefrontIcon className="h-4 w-4 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Sucursal WhatsApp
                </p>
                <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  {currentSucursalDisplayName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSheetSearchComprobante("")
                setComprobanteSheetOpen(true)
              }}
              disabled={comprobanteOptions.length === 0}
              className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-800/80 dark:hover:bg-slate-700/40"
            >
              <ClipboardDocumentListIcon className="h-4 w-4 shrink-0 text-violet-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Comprobante
                </p>
                <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  {currentComprobanteDisplayName}
                </p>
              </div>
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
            </button>
          </section>

          <section className="hidden shrink-0 grid-cols-2 gap-2 px-1 sm:grid">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Sucursal
              </p>
              <div className="min-w-0">
                <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
                  <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-300">
                    {currentSucursalDisplayName}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Comprobante
              </p>
              <div className="min-w-0">
                <Combobox
                  id="crm-quick-sale-comprobante"
                  value={selectedComprobanteValue}
                  options={filteredComprobanteOptions}
                  searchValue={comprobanteSearch}
                  onSearchValueChange={setComprobanteSearch}
                  onValueChange={handleComprobanteChange}
                  placeholder="Selecciona comprobante"
                  searchPlaceholder="Buscar comprobante..."
                  emptyMessage="No hay comprobantes activos"
                  disabled={comprobanteOptions.length === 0}
                  triggerClassName="h-9 text-[11px]"
                  searchInputClassName="text-xs"
                  contentClassName="max-w-[240px]"
                  optionClassName="py-1 text-[11px] leading-tight"
                  optionLabelClassName="text-[11px] leading-tight"
                  optionDescriptionClassName="text-[10px] leading-tight"
                />
              </div>
            </div>

          </section>

          {aiAttending ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-6 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
              <SparklesIcon className="h-8 w-8 text-amber-500" />
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                Kiments IA esta atendiendo este chat
              </p>
              <p className="text-[11px] leading-snug text-amber-700/80 dark:text-amber-200/70">
                Cambia a atencion humana para vender o registrar al cliente.
              </p>
            </div>
          ) : context ? (
            <CrmQuickSalePanelFlow
              conversationId={conversationId}
              context={context}
              selectedSucursalId={selectedSucursalId}
              selectedComprobanteId={selectedComprobanteId}
              contactPhone={clientPhone}
              onCompleted={handleSaleCompleted}
              onDraftChange={setSaleHasDraft}
              onPaymentPrepared={() => setSelectedComprobanteId(null)}
              onCustomerChanged={() => {
                void loadContext()
                onClientUpdated?.()
              }}
            />
          ) : null}
        </div>
      )}

      {isMobileDrawer ? (
        <Sheet open={registerOpen} onOpenChange={handleRegisterOpenChange}>
          <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-slate-200 p-0 pt-5 dark:border-slate-700">
            <SheetTitle className="sr-only">
              {isEditingClient ? "Editar cliente" : "Registrar cliente"}
            </SheetTitle>
            {registerClientForm}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={registerOpen} onOpenChange={handleRegisterOpenChange}>
          <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-xl border-slate-200 p-0 pt-5 dark:border-slate-700">
            <DialogTitle className="sr-only">
              {isEditingClient ? "Editar cliente" : "Registrar cliente"}
            </DialogTitle>
            {registerClientForm}
          </DialogContent>
        </Dialog>
      )}

      <Sheet open={comprobanteSheetOpen} onOpenChange={setComprobanteSheetOpen}>
        <SheetContent side="bottom" className="flex h-[70dvh] flex-col gap-0 p-0">
          <SheetHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4 dark:border-slate-700/60">
            <SheetTitle className="text-sm">Seleccionar Comprobante</SheetTitle>
          </SheetHeader>

          <div className="shrink-0 px-4 pt-3">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar comprobante..."
                value={sheetSearchComprobante}
                onChange={(event) => setSheetSearchComprobante(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-6 pt-2">
            {filteredComprobanteSheetOptions.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No se encontraron comprobantes
              </div>
            ) : (
              filteredComprobanteSheetOptions.map((option) => {
                const isSelected = option.value === selectedComprobanteValue
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      handleComprobanteChange(option.value)
                      setComprobanteSheetOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                      isSelected
                        ? "bg-violet-50 font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description ? (
                        <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <CheckCircleIcon className="h-4 w-4 shrink-0 text-violet-500" /> : null}
                  </button>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

    </div>
  )
}
