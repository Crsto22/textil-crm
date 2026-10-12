"use client"

import { useCallback, useEffect, useState, type ComponentType, type SVGProps } from "react"
import Image from "next/image"
import {
  BanknotesIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline"
import { Loader2, Pencil, Plus, WalletCards, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoaderSpinner } from "@/components/ui/loader-spinner"
import { authFetch } from "@/lib/auth/auth-fetch"

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
    .filter((account): account is Record<string, unknown> => !!account && typeof account === "object")
    .map((account) => ({
      idMetodoPagoCuenta: Number(account.idMetodoPagoCuenta) || 0,
      numeroCuenta: typeof account.numeroCuenta === "string" ? account.numeroCuenta.trim() : "",
    }))
    .filter((account) => account.idMetodoPagoCuenta > 0 && account.numeroCuenta)
}

function normalizeMethods(data: unknown): MetodoPago[] {
  if (!Array.isArray(data)) return []
  return data
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

interface CuentasDialogProps {
  method: MetodoPago
  onClose: () => void
  onSaved: () => void
}

function CuentasDialog({ method, onClose, onSaved }: CuentasDialogProps) {
  const [accounts, setAccounts] = useState(() => method.cuentas.map((account) => account.numeroCuenta))
  const [saving, setSaving] = useState(false)

  const addAccount = () => setAccounts((current) => [...current, ""])
  const updateAccount = (index: number, value: string) => {
    setAccounts((current) => current.map((account, position) => (position === index ? value : account)))
  }
  const removeAccount = (index: number) => {
    setAccounts((current) => current.filter((_, position) => position !== index))
  }

  const handleSave = async () => {
    const cleanAccounts = accounts.map((account) => account.trim()).filter(Boolean)
    if (new Set(cleanAccounts.map((account) => account.toLocaleLowerCase())).size !== cleanAccounts.length) {
      toast.error("No puedes registrar la misma cuenta dos veces")
      return
    }

    setSaving(true)
    try {
      const response = await authFetch(`/api/config/metodos-pago/${method.idMetodoPago}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: method.nombre,
          descripcion: method.descripcion,
          estado: method.estado,
          cuentas: cleanAccounts.map((numeroCuenta) => ({ numeroCuenta })),
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.message ?? "No se pudieron guardar las cuentas")
        return
      }
      toast.success(`Cuentas de ${method.nombre} actualizadas`)
      onSaved()
      onClose()
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-primary" />
            Cuentas de {method.nombre}
          </DialogTitle>
          <DialogDescription>
            Agrega, modifica o retira las cuentas disponibles para este método de pago.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Cuentas registradas</Label>
            <Button type="button" variant="outline" size="sm" onClick={addAccount} disabled={saving}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Nueva cuenta
            </Button>
          </div>

          {accounts.length === 0 ? (
            <button
              type="button"
              onClick={addAccount}
              disabled={saving}
              className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              Este método todavía no tiene cuentas. Haz clic para agregar una.
            </button>
          ) : (
            <div className="grid max-h-[320px] gap-2 overflow-y-auto pr-1">
              {accounts.map((account, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </div>
                  <Input
                    value={account}
                    onChange={(event) => updateAccount(index, event.target.value)}
                    placeholder="Número o identificación de la cuenta"
                    disabled={saving}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAccount(index)}
                    disabled={saving}
                    aria-label={`Retirar cuenta ${index + 1}`}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Guardando..." : "Guardar cuentas"}
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
  const [selectedMethod, setSelectedMethod] = useState<MetodoPago | null>(null)

  const loadMethods = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await authFetch("/api/config/metodos-pago")
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message ?? "Error al cargar los métodos de pago")
      setMethods(normalizeMethods(data))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) void loadMethods() })
    return () => { cancelled = true }
  }, [loadMethods])

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium">Cuentas por método de pago</p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Los métodos de pago ya están definidos. Aquí puedes registrar o actualizar únicamente sus cuentas.
        </p>
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

      {!loading && !error && methods.length === 0 && (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No hay métodos de pago configurados.
        </div>
      )}

      {!loading && !error && methods.length > 0 && (
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {methods.map((method) => {
            const isActive = method.estado === "ACTIVO"
            const methodKey = method.nombre.trim().toUpperCase()
            const Icon = ICON_MAP[methodKey] ?? CreditCardIcon
            const logo = PAYMENT_LOGOS[methodKey]

            return (
              <div
                key={method.idMetodoPago}
                className={`overflow-hidden rounded-xl border bg-card shadow-sm ${isActive ? "border-primary/20" : "border-border opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {logo ? (
                        <Image src={logo.src} alt={logo.alt} width={26} height={26} className="h-6 w-6 object-contain" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{method.nombre}</p>
                        <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                          {isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      {method.descripcion && (
                        <p className="truncate text-xs text-muted-foreground">{method.descripcion}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMethod(method)}
                    className="shrink-0 gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Cuentas
                  </Button>
                </div>

                <div className="border-t px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {method.cuentas.length === 1 ? "1 cuenta registrada" : `${method.cuentas.length} cuentas registradas`}
                  </p>
                  {method.cuentas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin cuentas asociadas.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {method.cuentas.map((account) => (
                        <span key={account.idMetodoPagoCuenta} className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs">
                          {account.numeroCuenta}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedMethod && (
        <CuentasDialog
          key={selectedMethod.idMetodoPago}
          method={selectedMethod}
          onClose={() => setSelectedMethod(null)}
          onSaved={() => void loadMethods()}
        />
      )}
    </div>
  )
}
