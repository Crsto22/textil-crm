"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowPathIcon,
  PencilSquareIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoaderSpinner } from "@/components/ui/loader-spinner"
import { PaginationResponsive } from "@/components/ui/pagination-responsive"
import { Switch } from "@/components/ui/switch"
import { authFetch } from "@/lib/auth/auth-fetch"
import { resolveBackendUrl } from "@/lib/resolve-backend-url"
import type { ProductoDetalleResponse, ProductoResumen } from "@/lib/types/producto"
import { toast } from "sonner"

interface PromocionComboItem {
  idProducto: number
  nombreProducto: string
  productoNombre?: string
  cantidadRequerida: number
}

interface PromocionCombo {
  idPromocionCombo: number
  nombre: string
  regla: string
  precioCombo: number
  estado: "ACTIVO" | "INACTIVO"
  fechaInicio: string | null
  fechaFin: string | null
  hastaAgotarStock: boolean
  items: PromocionComboItem[]
}

interface ComboFormState {
  nombre: string
  precioCombo: string
  fechaInicio: string
  fechaFin: string
  items: PromocionComboItem[]
}

interface ComboProductMeta {
  imageUrl: string | null
  priceMin: number | null
  priceMax: number | null
}

interface ComboPageData {
  content: PromocionCombo[]
  totalPages: number
  totalElements: number
}

type ComboVigencia = "TODAS" | "ACTIVAS" | "VENCIDAS"
type DurationMode = "HOY" | "3_DIAS" | "7_DIAS" | "STOCK" | "PERSONALIZADO"

const EMPTY_COMBO_FORM: ComboFormState = {
  nombre: "",
  precioCombo: "",
  fechaInicio: "",
  fechaFin: "",
  items: [],
}

function formatMoney(value: number) {
  return `S/ ${value.toFixed(2)}`
}

function formatTimeLeft(fechaFin: string | null) {
  if (!fechaFin) return "Sin vencimiento"
  const end = new Date(fechaFin).getTime()
  const now = Date.now()
  if (!Number.isFinite(end)) return "Sin vencimiento"
  if (end <= now) return "Vencido"
  const days = Math.ceil((end - now) / 86_400_000)
  if (days <= 1) return "Vence hoy"
  if (days < 30) return `Vence en ${days} dias`
  const months = Math.ceil(days / 30)
  return `Vence en ${months} mes${months === 1 ? "" : "es"}`
}

function priceLabel(meta: ComboProductMeta | undefined) {
  if (!meta || meta.priceMin === null) return "Precio no disponible"
  if (meta.priceMax !== null && meta.priceMax !== meta.priceMin) {
    return `${formatMoney(meta.priceMin)} - ${formatMoney(meta.priceMax)}`
  }
  return formatMoney(meta.priceMin)
}

function getProductStock(product: ProductoResumen) {
  return product.colores.reduce(
    (total, color) => total + color.tallas.reduce((sum, size) => sum + Math.max(0, Number(size.stock) || 0), 0),
    0,
  )
}

function comboNormalTotal(combo: PromocionCombo, metaByProduct: Record<number, ComboProductMeta>) {
  const total = combo.items.reduce((sum, item) => {
    const price = metaByProduct[item.idProducto]?.priceMin
    return price === null || price === undefined ? sum : sum + price * item.cantidadRequerida
  }, 0)
  return total > 0 ? total : null
}

function discountPercent(combo: PromocionCombo, metaByProduct: Record<number, ComboProductMeta>) {
  const normalTotal = comboNormalTotal(combo, metaByProduct)
  if (!normalTotal || combo.precioCombo >= normalTotal) return null
  return Math.round(((normalTotal - combo.precioCombo) / normalTotal) * 100)
}

function normalizeDateTime(value: string) {
  return value ? value : null
}

function toDatetimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function comboPayload(form: ComboFormState, durationMode: DurationMode) {
  return {
    nombre: form.nombre.trim(),
    precioCombo: Number(form.precioCombo),
    estado: "ACTIVO",
    fechaInicio: normalizeDateTime(form.fechaInicio),
    fechaFin: durationMode === "STOCK" ? null : normalizeDateTime(form.fechaFin),
    hastaAgotarStock: durationMode === "STOCK",
    items: form.items.map((item) => ({
      idProducto: item.idProducto,
      cantidadRequerida: item.cantidadRequerida,
    })),
  }
}

function formFromCombo(combo: PromocionCombo): ComboFormState {
  return {
    nombre: combo.nombre,
    precioCombo: String(combo.precioCombo),
    fechaInicio: combo.fechaInicio?.slice(0, 16) ?? "",
    fechaFin: combo.fechaFin?.slice(0, 16) ?? "",
    items: combo.items.map((item) => ({ ...item })),
  }
}

function normalizeCombo(combo: PromocionCombo): PromocionCombo {
  return {
    ...combo,
    hastaAgotarStock: Boolean(combo.hastaAgotarStock),
    items: combo.items.map((item) => ({
      ...item,
      nombreProducto: item.nombreProducto ?? item.productoNombre ?? "Producto",
    })),
  }
}

function validateComboForm(form: ComboFormState) {
  const total = form.items.reduce((sum, item) => sum + item.cantidadRequerida, 0)
  if (!form.nombre.trim()) return "Ingresa el nombre del combo"
  if (!Number.isFinite(Number(form.precioCombo)) || Number(form.precioCombo) <= 0) {
    return "Ingresa un precio combo valido"
  }
  if (total !== 2) return "El combo debe sumar exactamente 2 unidades"
  if (form.items.length === 0) return "Agrega al menos un producto"
  return null
}

export function ComboPromocionesTab() {
  const [activeCombos, setActiveCombos] = useState<PromocionCombo[]>([])
  const [activePage, setActivePage] = useState(0)
  const [activeTotalPages, setActiveTotalPages] = useState(0)
  const [activeTotalElements, setActiveTotalElements] = useState(0)
  const [form, setForm] = useState<ComboFormState>(EMPTY_COMBO_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PromocionCombo | null>(null)
  const [durationMode, setDurationMode] = useState<DurationMode>("HOY")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<ProductoResumen[]>([])
  const [productPage, setProductPage] = useState(0)
  const [productTotalPages, setProductTotalPages] = useState(1)
  const [searching, setSearching] = useState(false)
  const [productMeta, setProductMeta] = useState<Record<number, ComboProductMeta>>({})

  const fetchProductMeta = useCallback(async (rows: PromocionCombo[]) => {
    const ids = [...new Set(rows.flatMap((combo) => combo.items.map((item) => item.idProducto)))]
    if (ids.length === 0) return

    const entries = await Promise.all(
      ids.map(async (id) => {
        const response = await authFetch(`/api/producto/detalle/${id}`)
        const data = (await response.json().catch(() => null)) as ProductoDetalleResponse | null
        if (!response.ok || !data?.producto) return null
        const prices = data.variantes.map((item) => item.precio).filter((price) => Number.isFinite(price))
        return [
          id,
          {
            imageUrl: data.producto.imagenGlobalThumbUrl ?? data.producto.imagenGlobalUrl ?? null,
            priceMin: prices.length ? Math.min(...prices) : null,
            priceMax: prices.length ? Math.max(...prices) : null,
          },
        ] as const
      })
    )

    setProductMeta((current) => ({
      ...current,
      ...Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)),
    }))
  }, [])

  const fetchComboPage = useCallback(async (vigencia: ComboVigencia, page: number): Promise<ComboPageData | null> => {
    const params = new URLSearchParams({ page: String(page) })
    if (vigencia !== "TODAS") params.set("vigencia", vigencia)
    const response = await authFetch(`/api/ecommerce/promociones-combo?${params.toString()}`)
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      toast.error(data?.message ?? "No se pudieron cargar los combos")
      return null
    }
    const rows = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []
    return {
      content: rows.map(normalizeCombo),
      totalPages: Math.max(Number(data?.totalPages) || 0, 0),
      totalElements: Math.max(Number(data?.totalElements) || rows.length, 0),
    }
  }, [])

  const fetchCombos = useCallback(async () => {
    setLoading(true)
    const activeData = await fetchComboPage("ACTIVAS", activePage)
    if (activeData) {
      setActiveCombos(activeData.content)
      setActiveTotalPages(activeData.totalPages)
      setActiveTotalElements(activeData.totalElements)
    }
    setLoading(false)
    void fetchProductMeta(activeData?.content ?? [])
  }, [activePage, fetchComboPage, fetchProductMeta])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void fetchCombos()
    })
    return () => {
      cancelled = true
    }
  }, [fetchCombos])

  useEffect(() => {
    if (!dialogOpen) return

    const timer = window.setTimeout(() => {
      setSearching(true)
      authFetch(`/api/producto/buscar?q=${encodeURIComponent(search.trim())}&page=${productPage}&publicarEcommerce=true&soloDisponibles=true`)
        .then(async (response) => {
          const data = await response.json().catch(() => null)
          if (!response.ok) throw new Error(data?.message ?? "No se pudo buscar productos")
          setProducts(Array.isArray(data?.content) ? data.content : [])
          setProductTotalPages(Math.max(Number(data?.totalPages) || 1, 1))
        })
        .catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo buscar productos"))
        .finally(() => setSearching(false))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [dialogOpen, productPage, search])

  const resetForm = () => {
    setForm(EMPTY_COMBO_FORM)
    setEditingId(null)
    setDurationMode("HOY")
    setSearch("")
    setProductPage(0)
    setProductTotalPages(1)
    setProducts([])
  }

  const applyDuration = (mode: DurationMode) => {
    setDurationMode(mode)
    if (mode === "PERSONALIZADO") return
    const start = new Date()
    if (mode === "STOCK") {
      setForm((current) => ({ ...current, fechaInicio: toDatetimeLocal(start), fechaFin: "" }))
      return
    }
    const end = new Date(start)
    if (mode === "HOY") {
      end.setHours(23, 59, 0, 0)
    } else {
      end.setDate(end.getDate() + (mode === "3_DIAS" ? 3 : 7))
    }
    setForm((current) => ({
      ...current,
      fechaInicio: toDatetimeLocal(start),
      fechaFin: toDatetimeLocal(end),
    }))
  }

  const removeOneProduct = (idProducto: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.flatMap((item) =>
        item.idProducto === idProducto
          ? item.cantidadRequerida <= 1
            ? []
            : [{ ...item, cantidadRequerida: item.cantidadRequerida - 1 }]
          : [item]
      ),
    }))
  }

  const addProduct = (product: ProductoResumen) => {
    setProductMeta((current) => ({
      ...current,
      [product.idProducto]: {
        imageUrl: product.imagenGlobalThumbUrl ?? product.imagenGlobalUrl ?? null,
        priceMin: product.precioMin ?? null,
        priceMax: product.precioMax ?? null,
      },
    }))
    setForm((current) => {
      const existing = current.items.find((item) => item.idProducto === product.idProducto)
      const total = current.items.reduce((sum, item) => sum + item.cantidadRequerida, 0)
      if (!existing && total >= 2) return current
      if (existing) {
        if (total >= 2 || existing.cantidadRequerida >= 2) return current
        return {
          ...current,
          items: current.items.map((item) =>
            item.idProducto === product.idProducto
              ? { ...item, cantidadRequerida: Math.min(2, item.cantidadRequerida + 1) }
              : item
          ),
        }
      }
      return {
        ...current,
        items: [
          ...current.items,
          {
            idProducto: product.idProducto,
            nombreProducto: product.nombre,
            cantidadRequerida: 1,
          },
        ],
      }
    })
  }

  const saveCombo = async () => {
    const validation = validateComboForm(form)
    if (validation) {
      toast.error(validation)
      return
    }

    setSaving(true)
    const response = await authFetch(
      editingId ? `/api/ecommerce/promociones-combo/${editingId}` : "/api/ecommerce/promociones-combo",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comboPayload(form, durationMode)),
      }
    )
    const data = await response.json().catch(() => null)
    setSaving(false)

    if (!response.ok) {
      toast.error(data?.message ?? "No se pudo guardar el combo")
      return
    }

    toast.success(editingId ? "Combo actualizado" : "Combo creado")
    resetForm()
    setDialogOpen(false)
    await fetchCombos()
  }

  const changeEstado = async (combo: PromocionCombo) => {
    const estado = combo.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO"
    const response = await authFetch(`/api/ecommerce/promociones-combo/${combo.idPromocionCombo}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      toast.error(data?.message ?? "No se pudo cambiar el estado")
      return
    }
    toast.success(estado === "ACTIVO" ? "Combo activado" : "Combo desactivado")
    await fetchCombos()
  }

  const deleteCombo = async () => {
    if (!deleteTarget) {
      return
    }
    setDeleting(true)
    const response = await authFetch(`/api/ecommerce/promociones-combo/${deleteTarget.idPromocionCombo}`, {
      method: "DELETE",
    })
    const data = await response.json().catch(() => null)
    setDeleting(false)
    if (!response.ok) {
      toast.error(data?.message ?? "No se pudo eliminar el combo")
      return
    }
    toast.success("Combo eliminado")
    if (editingId === deleteTarget.idPromocionCombo) resetForm()
    setDeleteTarget(null)
    await fetchCombos()
  }

  const totalItems = form.items.reduce((sum, item) => sum + item.cantidadRequerida, 0)
  const comboSlots = form.items.flatMap((item) =>
    Array.from({ length: item.cantidadRequerida }, (_, index) => ({ ...item, slotKey: `${item.idProducto}-${index}` }))
  )
  const normalPreviewTotal = comboSlots.reduce((sum, item) => sum + (productMeta[item.idProducto]?.priceMin ?? 0), 0)
  const comboPreviewPrice = Number(form.precioCombo) || 0
  const previewSavings = normalPreviewTotal > 0 && comboPreviewPrice > 0 ? normalPreviewTotal - comboPreviewPrice : 0
  const totalCombos = activeTotalElements

  const renderComboSection = (
    title: string,
    description: string,
    rows: PromocionCombo[],
    page: number,
    totalPages: number,
    totalElements: number,
    onPageChange: (value: number | ((prev: number) => number)) => void
  ) => (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {rows.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border text-center text-sm text-muted-foreground">
          <TagIcon className="h-5 w-5" />
          <p>No hay promociones en esta seccion.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Productos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Nombre</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground md:table-cell">Vigencia</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Precio</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground sm:table-cell">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((combo) => {
                  const descuento = discountPercent(combo, productMeta)
                  const normal = comboNormalTotal(combo, productMeta)
                  return (
                  <tr key={combo.idPromocionCombo} className="bg-background transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex -space-x-2">
                        {combo.items.map((item) => (
                          <div key={item.idProducto} className="h-9 w-9 overflow-hidden rounded-full border-2 border-background bg-muted">
                            {productMeta[item.idProducto]?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolveBackendUrl(productMeta[item.idProducto].imageUrl) ?? ""}
                                alt={item.nombreProducto}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                                {item.nombreProducto.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-0 max-w-48">
                        <p className="truncate font-semibold">{combo.nombre}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {descuento !== null && (
                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              -{descuento}%
                            </span>
                          )}
                          {combo.items.map((item) => (
                            <span key={item.idProducto} className="text-xs text-muted-foreground">
                              {item.nombreProducto} x{item.cantidadRequerida}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="text-xs font-medium text-amber-600 whitespace-nowrap">{combo.hastaAgotarStock ? "Hasta agotar stock" : formatTimeLeft(combo.fechaFin)}</p>
                      {!combo.hastaAgotarStock && combo.fechaFin && (
                        <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(combo.fechaFin).toLocaleDateString("es-PE")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-bold">{formatMoney(combo.precioCombo)}</p>
                      {normal !== null && (
                        <p className="text-xs text-muted-foreground line-through">{formatMoney(normal)}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-center sm:table-cell">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${combo.estado === "ACTIVO" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {combo.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Switch
                          checked={combo.estado === "ACTIVO"}
                          onCheckedChange={() => void changeEstado(combo)}
                          aria-label={`${combo.estado === "ACTIVO" ? "Desactivar" : "Activar"} ${combo.nombre}`}
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                          setEditingId(combo.idPromocionCombo)
                          setDurationMode(combo.hastaAgotarStock ? "STOCK" : "PERSONALIZADO")
                          setForm(formFromCombo(combo))
                          setDialogOpen(true)
                        }}>
                          <PencilSquareIcon className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(combo)}>
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <PaginationResponsive
        totalElements={totalElements}
        totalPages={totalPages}
        page={page}
        onPageChange={onPageChange}
        itemLabel="promociones"
      />
    </section>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          className="gap-2"
          onClick={() => {
            resetForm()
            applyDuration("HOY")
            setDialogOpen(true)
          }}
        >
          <PlusIcon className="h-4 w-4" />
          Agregar combo
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar combo" : "Agregar combo"}</DialogTitle>
            <DialogDescription>Solo productos visibles en ecommerce. Las variantes no se configuran aqui.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Datos generales</p>
                <label className="grid gap-1 text-sm font-medium">
                  Nombre
                  <input
                    value={form.nombre}
                    onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    placeholder="2 Belinda S/160"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Precio combo
                  <span className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">S/</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.precioCombo}
                      onChange={(event) => setForm((current) => ({ ...current, precioCombo: event.target.value }))}
                      className="h-10 w-full rounded-md border bg-background px-3 pl-9 text-sm"
                      placeholder="160"
                    />
                  </span>
                </label>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Duracion de la oferta</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["HOY", "Hoy"],
                    ["3_DIAS", "3 dias"],
                    ["7_DIAS", "7 dias"],
                    ["STOCK", "Hasta agotar stock"],
                    ["PERSONALIZADO", "Personalizado"],
                  ].map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={durationMode === value ? "default" : "outline"}
                      size="sm"
                      className="h-auto min-h-9 whitespace-normal px-2 py-2 text-xs"
                      onClick={() => applyDuration(value as DurationMode)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {durationMode === "PERSONALIZADO" && (
                  <div className="grid gap-3">
                    <label className="grid gap-1 text-sm font-medium">
                      Fecha inicio
                      <input
                        type="datetime-local"
                        value={form.fechaInicio}
                        onChange={(event) => setForm((current) => ({ ...current, fechaInicio: event.target.value }))}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Fecha fin
                      <input
                        type="datetime-local"
                        value={form.fechaFin}
                        onChange={(event) => setForm((current) => ({ ...current, fechaFin: event.target.value }))}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => void saveCombo()} disabled={saving} className="w-full gap-2">
                  {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TagIcon className="h-4 w-4" />}
                  {editingId ? "Guardar cambios" : "Crear combo"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full">
                    Cancelar
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Buscar productos visibles en ecommerce</p>
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setProductPage(0)
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  placeholder="Belinda, Camila..."
                />
                <div className="max-h-72 overflow-y-auto rounded-md border bg-background p-2">
                  {searching ? (
                    <LoaderSpinner size="sm" className="py-8" />
                  ) : products.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No hay productos para mostrar.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {products.map((product) => {
                        const selected = form.items.find((item) => item.idProducto === product.idProducto)
                        const disabled = totalItems >= 2 && (!selected || selected.cantidadRequerida >= 2)
                        const imageUrl = resolveBackendUrl(product.imagenGlobalThumbUrl ?? product.imagenGlobalUrl)
                        return (
                          <button
                            key={product.idProducto}
                            type="button"
                            disabled={disabled}
                            onClick={() => addProduct(product)}
                            className="flex min-w-0 items-center gap-3 rounded-md border p-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                              {imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imageUrl} alt={product.nombre} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
                                  {product.nombre.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{product.nombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {priceLabel({
                                  imageUrl: null,
                                  priceMin: product.precioMin ?? null,
                                  priceMax: product.precioMax ?? null,
                                })}
                              </p>
                              <p className="text-[10px] text-emerald-600">Stock ecommerce: {getProductStock(product)}</p>
                            </div>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              {selected ? selected.cantidadRequerida : <PlusIcon className="h-4 w-4" />}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pag {productPage + 1} de {productTotalPages}</span>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" disabled={productPage <= 0} onClick={() => setProductPage((page) => Math.max(0, page - 1))}>
                      Anterior
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={productPage >= productTotalPages - 1} onClick={() => setProductPage((page) => page + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Incluidos en el combo</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{totalItems}</span>
                </div>
                <div className="flex flex-wrap items-start justify-center gap-3">
                  {[0, 1].map((index) => {
                    const item = comboSlots[index]
                    const meta = item ? productMeta[item.idProducto] : undefined
                    return (
                      <div key={item?.slotKey ?? `empty-${index}`} className="flex flex-col items-center gap-2">
                        <div className={`group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 ${item ? "border-primary bg-muted" : "border-dashed border-muted-foreground/40 bg-muted/20"}`}>
                          {item && meta?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveBackendUrl(meta.imageUrl) ?? ""} alt={item.nombreProducto} className="h-full w-full object-cover" />
                          ) : item ? (
                            <span className="text-lg font-bold text-muted-foreground">{item.nombreProducto.slice(0, 1).toUpperCase()}</span>
                          ) : (
                            <PlusIcon className="h-6 w-6 text-muted-foreground/60" />
                          )}
                          {item && (
                            <button
                              type="button"
                              aria-label={`Quitar ${item.nombreProducto}`}
                              onClick={() => removeOneProduct(item.idProducto)}
                              className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                        <p className="max-w-28 truncate text-center text-xs font-medium">{item?.nombreProducto ?? "Producto"}</p>
                        <p className="text-xs text-muted-foreground">{item ? priceLabel(meta) : "S/ 0.00"}</p>
                      </div>
                    )
                  })}
                  <div className="flex min-w-32 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total normal</p>
                    <p className="text-lg font-black">{formatMoney(normalPreviewTotal)}</p>
                    <p className="text-xs text-muted-foreground">Combo</p>
                    <p className="text-lg font-black text-primary">{formatMoney(comboPreviewPrice)}</p>
                  </div>
                </div>
                {previewSavings > 0 && (
                  <div className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                    Ahorra {formatMoney(previewSavings)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar combo</DialogTitle>
            <DialogDescription>
              Esta accion eliminara el combo {deleteTarget ? `"${deleteTarget.nombre}"` : ""}. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void deleteCombo()}>
              {deleting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <LoaderSpinner size="sm" />
          </div>
        ) : totalCombos === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border text-center text-sm text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border">
              <TagIcon className="h-6 w-6" />
            </div>
            <p>No hay combos registrados.</p>
          </div>
        ) : (
          renderComboSection(
            "Promociones vigentes",
            "Combos disponibles por estado, vigencia y stock actual.",
            activeCombos,
            activePage,
            activeTotalPages,
            activeTotalElements,
            setActivePage
          )
        )}
      </div>
    </div>
  )
}
