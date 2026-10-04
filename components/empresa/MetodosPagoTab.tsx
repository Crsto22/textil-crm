"use client"

import { useState, useEffect, useCallback, type ComponentType, type SVGProps } from "react"
import Image from "next/image"
import {
  BanknotesIcon,
  DevicePhoneMobileIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline"
import { Pencil, Plus, Trash2, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { LoaderSpinner } from "@/components/ui/loader-spinner"
import { authFetch } from "@/lib/auth/auth-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"

const ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  EFECTIVO: BanknotesIcon,
  YAPE: DevicePhoneMobileIcon,
  PLIN: DevicePhoneMobileIcon,
  TRANSFERENCIA: BuildingLibraryIcon,
  TARJETA: CreditCardIcon,
}

const PAYMENT_LOGOS: Record<string, { src: string; alt: string }> = {
  EFECTIVO: { src: "/img/efectivo.png", alt: "Efectivo" },
  YAPE: { src: "/img/yape-app-seeklogo.png", alt: "Yape" },
  PLIN: { src: "/img/plin-seeklogo.png", alt: "Plin" },
}

interface MetodoPagoCuenta {
  idMetodoPagoCuenta: number
  numeroCuenta: string
}

interface MetodoPago {
  idMetodoPago: number
  nombre: string
  descripcion: string | null
  estado: "ACTIVO" | "INACTIVO"
  cuentas: MetodoPagoCuenta[]
}

function normalizeEstado(value: unknown): "ACTIVO" | "INACTIVO" {
  if (value === true) return "ACTIVO"
  if (value === false) return "INACTIVO"
  if (typeof value !== "string") return "INACTIVO"
  return value.trim().toUpperCase() === "ACTIVO" ? "ACTIVO" : "INACTIVO"
}

function normalizeCuentas(value: unknown): MetodoPagoCuenta[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      idMetodoPagoCuenta: Number(c.idMetodoPagoCuenta) || 0,
      numeroCuenta: typeof c.numeroCuenta === "string" ? c.numeroCuenta : "",
    }))
    .filter((c) => c.idMetodoPagoCuenta > 0 && c.numeroCuenta)
}

function normalizeMethods(data: unknown): MetodoPago[] {
  const raw = Array.isArray(data) ? data : []
  return raw
    .map((value): MetodoPago | null => {
      if (!value || typeof value !== "object") return null
      const item = value as Record<string, unknown>
      const idMetodoPago = Number(item.idMetodoPago)
      const nombre = typeof item.nombre === "string" ? item.nombre.trim() : ""
      if (!Number.isFinite(idMetodoPago) || idMetodoPago <= 0 || !nombre) return null
      return {
        idMetodoPago,
        nombre,
        descripcion: typeof item.descripcion === "string" ? item.descripcion : null,
        estado: normalizeEstado(item.estado),
        cuentas: normalizeCuentas(item.cuentas),
      }
    })
    .filter((item): item is MetodoPago => item !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

interface MetodoPagoFormDialogProps {
  editing: MetodoPago | null
  onClose: () => void
  onSaved: () => void
}

function MetodoPagoFormDialog({ editing, onClose, onSaved }: MetodoPagoFormDialogProps) {
  const [nombre, setNombre] = useState(editing?.nombre ?? "")
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? "")
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">(editing?.estado ?? "ACTIVO")
  const [cuentas, setCuentas] = useState<string[]>(
    editing ? editing.cuentas.map((c) => c.numeroCuenta) : [],
  )
  const [saving, setSaving] = useState(false)

  const addCuenta = () => setCuentas((prev) => [...prev, ""])
  const removeCuenta = (i: number) => setCuentas((prev) => prev.filter((_, idx) => idx !== i))
  const updateCuenta = (i: number, val: string) =>
    setCuentas((prev) => prev.map((c, idx) => (idx === i ? val : c)))

  const handleSave = async () => {
    const trimmedNombre = nombre.trim()
    if (!trimmedNombre) {
      toast.error("El nombre es requerido")
      return
    }

    const payload = {
      nombre: trimmedNombre,
      estado,
      descripcion: descripcion.trim() || null,
      cuentas: cuentas.map((c) => c.trim()).filter(Boolean).map((numeroCuenta) => ({ numeroCuenta })),
    }

    setSaving(true)
    try {
      const url = editing
        ? `/api/config/metodos-pago/${editing.idMetodoPago}`
        : "/api/config/metodos-pago"
      const res = await authFetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.message ?? "Error al guardar")
        return
      }
      toast.success(editing ? "Metodo actualizado" : "Metodo creado correctamente")
      onSaved()
      onClose()
    } catch {
      toast.error("Error de conexion")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar metodo de pago" : "Nuevo metodo de pago"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Modifica los datos del metodo de pago."
              : "Completa los datos para registrar un nuevo metodo de pago."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="mp-nombre">Nombre</Label>
            <Input
              id="mp-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. TRANSFERENCIA"
              disabled={saving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mp-desc">
              Descripcion{" "}
              <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>
            </Label>
            <Input
              id="mp-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Banco principal"
              disabled={saving}
            />
          </div>

          {editing && (
            <div className="grid gap-2">
              <Label>Estado</Label>
              <div className="flex gap-2">
                {(["ACTIVO", "INACTIVO"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    disabled={saving}
                    onClick={() => setEstado(e)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${estado === e
                      ? e === "ACTIVO"
                        ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                        : "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                      }`}
                  >
                    {e === "ACTIVO" ? "Activo" : "Inactivo"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>
                Cuentas{" "}
                <span className="text-xs font-normal text-muted-foreground">(Opcional)</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={addCuenta}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="h-3 w-3" /> Agregar cuenta
              </Button>
            </div>
            {cuentas.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin cuentas asociadas</p>
            )}
            {cuentas.map((c, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={c}
                  onChange={(e) => updateCuenta(i, e.target.value)}
                  placeholder="Ej. 001-1234567890"
                  disabled={saving}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={saving}
                  onClick={() => removeCuenta(i)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear metodo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface MetodoPagoDeleteDialogProps {
  open: boolean
  target: MetodoPago | null
  deleting: boolean
  onClose: () => void
  onConfirm: (id: number) => Promise<void>
}

function MetodoPagoDeleteDialog({
  open,
  target,
  deleting,
  onClose,
  onConfirm,
}: MetodoPagoDeleteDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !deleting) onClose()
  }

  const handleConfirm = async () => {
    if (!target) return
    await onConfirm(target.idMetodoPago)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Eliminar metodo de pago</DialogTitle>
          <DialogDescription>
            {`Se eliminara "${target?.nombre ?? ""}" de forma logica. Esta accion lo dejara inactivo y oculto en listados.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deleting}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={deleting || !target}>
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MetodosPagoTab() {
  const [methods, setMethods] = useState<MetodoPago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<MetodoPago | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MetodoPago | null>(null)

  const loadMethods = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch("/api/config/metodos-pago")
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message ?? "Error al cargar metodos de pago")
      }
      const data = await res.json()
      setMethods(normalizeMethods(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void loadMethods()
    })
    return () => {
      cancelled = true
    }
  }, [loadMethods])

  const toggleMethod = async (metodo: MetodoPago) => {
    const nuevoEstado: MetodoPago["estado"] = metodo.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO"
    setToggling(metodo.idMetodoPago)
    setMethods((prev) =>
      prev.map((m) => (m.idMetodoPago === metodo.idMetodoPago ? { ...m, estado: nuevoEstado } : m))
    )
    try {
      const res = await authFetch(`/api/config/metodos-pago/${metodo.idMetodoPago}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (!res.ok) {
        setMethods((prev) =>
          prev.map((m) => (m.idMetodoPago === metodo.idMetodoPago ? { ...m, estado: metodo.estado } : m))
        )
        const data = await res.json().catch(() => null)
        toast.error(res.status === 403 ? "Sin permisos para esta accion" : (data?.message ?? `Error ${res.status}`))
        return
      }
      const responseData = await res.json().catch(() => null)
      const backendEstado = normalizeEstado(responseData?.estado ?? nuevoEstado)
      setMethods((prev) =>
        prev.map((m) => (m.idMetodoPago === metodo.idMetodoPago ? { ...m, estado: backendEstado } : m))
      )
      toast.success(`${metodo.nombre} ${backendEstado === "ACTIVO" ? "activado" : "desactivado"}`)
    } catch {
      setMethods((prev) =>
        prev.map((m) => (m.idMetodoPago === metodo.idMetodoPago ? { ...m, estado: metodo.estado } : m))
      )
      toast.error("Error de conexion")
    } finally {
      setToggling(null)
    }
  }

  const openCreate = () => { setEditingMethod(null); setFormOpen(true) }
  const openEdit = (m: MetodoPago) => { setEditingMethod(m); setFormOpen(true) }
  const openDelete = (m: MetodoPago) => setDeleteTarget(m)

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      const res = await authFetch(`/api/config/metodos-pago/eliminar/${id}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.message ?? "Error al eliminar metodo de pago")
        return
      }

      toast.success(data?.message ?? "Metodo de pago eliminado correctamente")
      setDeleteTarget(null)
      await loadMethods()
    } catch {
      toast.error("Error de conexion")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Administra los metodos de pago disponibles y sus cuentas.
        </p>
        <Button size="sm" onClick={openCreate} className="gap-1.5 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Nuevo metodo
        </Button>
      </div>

      {loading && (
        <div className="flex w-full items-center justify-center rounded-xl border border-dashed py-16">
          <LoaderSpinner size="sm" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <p className="font-semibold">{error}</p>
          <button onClick={loadMethods} className="mt-1 text-xs underline opacity-80 hover:opacity-100">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {methods.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No hay metodos de pago registrados.
              </p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Crear el primero
              </Button>
            </div>
          )}

          {methods.map((m) => {
            const isActive = m.estado === "ACTIVO"
            const methodKey = m.nombre.trim().toUpperCase()
            const Icon = ICON_MAP[methodKey] ?? CreditCardIcon
            const logo = PAYMENT_LOGOS[methodKey]
            const isToggling = toggling === m.idMetodoPago

            return (
              <div
                key={m.idMetodoPago}
                className={`rounded-xl border bg-card shadow-sm transition-colors ${isActive
                  ? "border-primary/20"
                  : "border-border opacity-70"
                  }`}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                      }`}>
                      {logo ? (
                        <Image
                          src={logo.src}
                          alt={logo.alt}
                          width={26}
                          height={26}
                          className="h-6 w-6 object-contain"
                        />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{m.nombre}</p>
                        <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                          {isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      {m.descripcion && (
                        <p className="truncate text-xs text-muted-foreground">{m.descripcion}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => openDelete(m)}
                      disabled={isToggling || deleting === m.idMetodoPago}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => void toggleMethod(m)}
                      disabled={isToggling}
                      aria-label={`${isActive ? "Desactivar" : "Activar"} ${m.nombre}`}
                    />
                  </div>
                </div>

                {m.cuentas.length > 0 && (
                  <div className="border-t px-4 pb-3 pt-2.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Cuentas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.cuentas.map((c) => (
                        <span
                          key={c.idMetodoPagoCuenta}
                          className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs"
                        >
                          {c.numeroCuenta}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {formOpen && (
        <MetodoPagoFormDialog
          key={editingMethod?.idMetodoPago ?? "new"}
          editing={editingMethod}
          onClose={() => setFormOpen(false)}
          onSaved={loadMethods}
        />
      )}

      <MetodoPagoDeleteDialog
        open={deleteTarget !== null}
        target={deleteTarget}
        deleting={deleting !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
