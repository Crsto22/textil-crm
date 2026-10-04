"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowPathIcon,
  PhotoIcon,
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
import { authFetch } from "@/lib/auth/auth-fetch"
import { resolveBackendUrl } from "@/lib/resolve-backend-url"
import { useOfertasEcommerce, type ProductoOfertaAgrupada } from "@/lib/hooks/useOfertasEcommerce"
import { obtenerCountdownOfertaResumido, formatearRangoOferta } from "@/lib/oferta-utils"
import type { ProductoResumen } from "@/lib/types/producto"
import { toast } from "sonner"

function formatMoney(value: number) {
  return `S/ ${value.toFixed(2)}`
}

function getEstadoLabel(estado: string) {
  switch (estado) {
    case "activa": return "Activa"
    case "programada": return "Programada"
    case "vencida": return "Vencida"
    case "indefinida": return "Sin fecha"
    default: return "Sin oferta"
  }
}

function getEstadoBadge(estado: string) {
  switch (estado) {
    case "activa":
      return "bg-emerald-100 text-emerald-700"
    case "programada":
      return "bg-amber-100 text-amber-700"
    case "vencida":
      return "bg-rose-100 text-rose-700"
    case "indefinida":
      return "bg-slate-100 text-slate-600"
    default:
      return "bg-slate-100 text-slate-500"
  }
}

function getPriceRangeLabel(min: number | null, max: number | null) {
  if (min === null || max === null) return "-"
  if (min === max) return formatMoney(min)
  return `${formatMoney(min)} - ${formatMoney(max)}`
}

function getProductStock(product: ProductoResumen) {
  return product.colores.reduce(
    (total, color) => total + color.tallas.reduce((sum, size) => sum + Math.max(0, Number(size.stock) || 0), 0),
    0,
  )
}

type OfferDuration = "HOY" | "3_DIAS" | "7_DIAS" | "STOCK" | "PERSONALIZADO"

function toDatetimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function toApiLocalDateTime(value: string) {
  if (!value) return ""
  return value.length === 16 ? `${value}:00` : value
}

export function OfertasEcommerceTab() {
  const { ofertas, loading, saving, crearOfertaProducto, eliminarOfertaProducto } = useOfertasEcommerce()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProductoOfertaAgrupada | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [productSearch, setProductSearch] = useState("")
  const [products, setProducts] = useState<ProductoResumen[]>([])
  const [productPage, setProductPage] = useState(0)
  const [productTotalPages, setProductTotalPages] = useState(1)
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductoResumen | null>(null)

  const [priceMode, setPriceMode] = useState<"PRECIO_FIJO" | "DESCUENTO_PORCENTAJE">("DESCUENTO_PORCENTAJE")
  const [priceValue, setPriceValue] = useState("")
  const [duration, setDuration] = useState<OfferDuration>("7_DIAS")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")

  const applyDuration = (mode: OfferDuration) => {
    setDuration(mode)
    if (mode === "PERSONALIZADO") return

    const now = new Date()
    const start = toDatetimeLocal(now)
    if (mode === "STOCK") {
      setFechaInicio(start)
      setFechaFin("")
      return
    }
    const end = new Date(now)

    if (mode === "HOY") {
      end.setHours(23, 59, 0, 0)
    } else if (mode === "3_DIAS") {
      end.setDate(end.getDate() + 3)
    } else if (mode === "7_DIAS") {
      end.setDate(end.getDate() + 7)
    }

    setFechaInicio(start)
    setFechaFin(toDatetimeLocal(end))
  }

  const resetForm = () => {
    setProductSearch("")
    setProducts([])
    setProductPage(0)
    setProductTotalPages(1)
    setSelectedProduct(null)
    setPriceMode("DESCUENTO_PORCENTAJE")
    setPriceValue("")
    setDuration("7_DIAS")
    setFechaInicio("")
    setFechaFin("")
  }

  const openDialog = () => {
    resetForm()
    applyDuration("7_DIAS")
    setDialogOpen(true)
  }

  useEffect(() => {
    if (!dialogOpen) return

    const timer = window.setTimeout(() => {
      setSearching(true)
      authFetch(`/api/producto/buscar?q=${encodeURIComponent(productSearch.trim())}&page=${productPage}&publicarEcommerce=true&soloDisponibles=true`)
        .then(async (res) => {
          const data = await res.json().catch(() => null)
          if (!res.ok) throw new Error(data?.message ?? "Error al buscar")
          setProducts(Array.isArray(data?.content) ? data.content : [])
          setProductTotalPages(Math.max(Number(data?.totalPages) || 1, 1))
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : "Error al buscar productos"))
        .finally(() => setSearching(false))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [dialogOpen, productSearch, productPage])

  const previewPrice = useMemo(() => {
    if (!selectedProduct || !priceValue) return null
    const val = Number(priceValue)
    if (!Number.isFinite(val) || val <= 0) return null

    if (priceMode === "PRECIO_FIJO") {
      return val
    }

    const prices = [selectedProduct.precioMin, selectedProduct.precioMax].filter((p): p is number => typeof p === "number" && Number.isFinite(p))
    if (prices.length === 0) return null
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length

    if (val >= 100) return null
    return Math.round((avgPrice * (1 - val / 100) + Number.EPSILON) * 100) / 100
  }, [selectedProduct, priceValue, priceMode])

  const canSave = selectedProduct && priceValue && Number.isFinite(Number(priceValue)) && Number(priceValue) > 0 && (duration !== "PERSONALIZADO" || (fechaInicio && fechaFin))

  const handleCreate = async () => {
    if (!selectedProduct) return
    const val = Number(priceValue)
    if (!Number.isFinite(val) || val <= 0) {
      toast.error("Ingresa un valor valido")
      return
    }

    const inicioStr = toApiLocalDateTime(fechaInicio || toDatetimeLocal(new Date()))
    const finStr = duration === "STOCK" ? "" : toApiLocalDateTime(fechaFin)

    const created = await crearOfertaProducto(selectedProduct.idProducto, priceMode, val, inicioStr, finStr, duration === "STOCK")
    if (!created) return

    setDialogOpen(false)
    resetForm()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await eliminarOfertaProducto(deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const ofertasActivas = ofertas.filter((o) => o.estado === "activa" || o.estado === "programada" || o.estado === "indefinida")

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{ofertasActivas.length} producto{ofertasActivas.length !== 1 ? "s" : ""} con oferta vigente</p>
        <Button onClick={openDialog} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Agregar oferta
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
            <DialogTitle>Agregar oferta a producto</DialogTitle>
            <DialogDescription>La oferta se aplicara a todas las variantes del producto seleccionado.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Modo de precio</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={priceMode === "DESCUENTO_PORCENTAJE" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriceMode("DESCUENTO_PORCENTAJE")}
                    className="flex-1"
                  >
                    % Descuento
                  </Button>
                  <Button
                    type="button"
                    variant={priceMode === "PRECIO_FIJO" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriceMode("PRECIO_FIJO")}
                    className="flex-1"
                  >
                    Precio fijo
                  </Button>
                </div>
                <label className="grid gap-1 text-sm font-medium">
                  {priceMode === "DESCUENTO_PORCENTAJE" ? "Porcentaje de descuento" : "Precio de oferta"}
                  <span className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {priceMode === "DESCUENTO_PORCENTAJE" ? "%" : "S/"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step={priceMode === "DESCUENTO_PORCENTAJE" ? "1" : "0.01"}
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${priceMode === "DESCUENTO_PORCENTAJE" ? "pl-9" : "pl-10"}`}
                      placeholder={priceMode === "DESCUENTO_PORCENTAJE" ? "20" : "80.00"}
                    />
                  </span>
                </label>
                {previewPrice !== null && (
                  <div className="rounded-md bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
                    {priceMode === "DESCUENTO_PORCENTAJE" ? (
                      <p>
                        Precio oferta estimado: <span className="font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(previewPrice)}</span>
                      </p>
                    ) : (
                      <p>
                        Precio fijo para todas las variantes: <span className="font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(previewPrice)}</span>
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">Calculado sobre el promedio de precios de las variantes</p>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Duracion de la oferta</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["HOY", "Hoy"] as const,
                    ["3_DIAS", "3 dias"] as const,
                    ["7_DIAS", "7 dias"] as const,
                    ["STOCK", "Hasta agotar stock"] as const,
                    ["PERSONALIZADO", "Personalizado"] as const,
                  ].map(([val, label]) => (
                    <Button
                      key={val}
                      type="button"
                      variant={duration === val ? "default" : "outline"}
                      size="sm"
                      className="h-auto min-h-9 whitespace-normal px-2 py-2 text-xs"
                      onClick={() => applyDuration(val)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {duration === "PERSONALIZADO" && (
                  <div className="grid gap-3">
                    <label className="grid gap-1 text-sm font-medium">
                      Fecha inicio
                      <input
                        type="datetime-local"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Fecha fin
                      <input
                        type="datetime-local"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => void handleCreate()} disabled={!canSave || saving} className="w-full gap-2">
                  {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TagIcon className="h-4 w-4" />}
                  {saving ? "Creando..." : "Crear oferta"}
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={() => { resetForm(); setDialogOpen(false) }} className="w-full">
                  Cancelar
                </Button>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Buscar producto</p>
                <input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    setProductPage(0)
                    setSelectedProduct(null)
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
                      {products.map((p) => {
                        const img = resolveBackendUrl(p.imagenGlobalThumbUrl ?? p.imagenGlobalUrl)
                        const isSelected = selectedProduct?.idProducto === p.idProducto
                        return (
                          <button
                            key={p.idProducto}
                            type="button"
                            onClick={() => setSelectedProduct(p)}
                            className={`flex min-w-0 items-center gap-3 rounded-md border p-2 text-left text-sm hover:bg-muted transition-colors ${isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : ""}`}
                          >
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt={p.nombre} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
                                  {p.nombre.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{p.nombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {getPriceRangeLabel(p.precioMin ?? null, p.precioMax ?? null)}
                              </p>
                              <p className="text-[10px] text-emerald-600">Stock ecommerce: {getProductStock(p)}</p>
                            </div>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              {isSelected ? <span className="text-xs font-bold text-primary">&radic;</span> : <PlusIcon className="h-4 w-4" />}
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
                    <Button type="button" variant="outline" size="sm" disabled={productPage <= 0} onClick={() => setProductPage((p) => Math.max(0, p - 1))}>
                      Anterior
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={productPage >= productTotalPages - 1} onClick={() => setProductPage((p) => p + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              </div>

              {selectedProduct && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {(() => {
                        const img = resolveBackendUrl(selectedProduct.imagenGlobalThumbUrl ?? selectedProduct.imagenGlobalUrl)
                        return img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={selectedProduct.nombre} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                            {selectedProduct.nombre.slice(0, 2).toUpperCase()}
                          </div>
                        )
                      })()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold">{selectedProduct.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {getPriceRangeLabel(selectedProduct.precioMin ?? null, selectedProduct.precioMax ?? null)}
                      </p>
                      <p className="text-xs font-medium text-emerald-600">Stock ecommerce: {getProductStock(selectedProduct)}</p>
                    </div>
                  </div>
                  {canSave && previewPrice !== null && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Precio oferta</span>
                        <span className="text-lg font-black text-primary">{formatMoney(previewPrice)}</span>
                      </div>
                      <p className="mt-1 text-center text-xs text-muted-foreground">
                        Se aplicara a todas las variantes del producto
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar oferta</DialogTitle>
            <DialogDescription>
              Se eliminara la oferta de {deleteTarget ? `"${deleteTarget.productoNombre}"` : ""} en todas sus variantes. Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center">
          <LoaderSpinner size="sm" />
        </div>
      ) : ofertasActivas.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border text-center text-sm text-muted-foreground">
          <TagIcon className="h-8 w-8" />
          <p>No hay ofertas registradas en ecommerce.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ofertasActivas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Ofertas vigentes ({ofertasActivas.length})</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Producto</th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground md:table-cell">Precio normal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Precio oferta</th>
                      <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground sm:table-cell">Descuento</th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground lg:table-cell">Vigencia</th>
                      <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground sm:table-cell">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ofertasActivas.map((oferta) => (
                      <tr key={oferta.productoId} className="bg-background transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                              {oferta.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={resolveBackendUrl(oferta.imageUrl) ?? ""}
                                  alt={oferta.productoNombre}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <PhotoIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 max-w-48">
                              <p className="truncate font-semibold">{oferta.productoNombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {oferta.variantesConOferta} / {oferta.totalVariantes} variantes
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <p className="text-xs">{getPriceRangeLabel(oferta.precioNormalMin, oferta.precioNormalMax)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-primary">{getPriceRangeLabel(oferta.precioOfertaMin, oferta.precioOfertaMax)}</p>
                        </td>
                        <td className="hidden px-4 py-3 text-center sm:table-cell">
                          {oferta.descuentoPromedio !== null ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                              -{oferta.descuentoPromedio}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <div className="text-xs">
                            <p>{oferta.hastaAgotarStock ? "Hasta agotar stock" : formatearRangoOferta(oferta.fechaInicio, oferta.fechaFin)}</p>
                            {!oferta.hastaAgotarStock && oferta.estado === "activa" && obtenerCountdownOfertaResumido({ ofertaInicio: oferta.fechaInicio, ofertaFin: oferta.fechaFin }) && (
                              <p className="font-medium text-amber-600">{obtenerCountdownOfertaResumido({ ofertaInicio: oferta.fechaInicio, ofertaFin: oferta.fechaFin })?.texto}</p>
                            )}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-center sm:table-cell">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getEstadoBadge(oferta.estado)}`}>
                            {oferta.hastaAgotarStock ? "Hasta stock" : getEstadoLabel(oferta.estado)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(oferta)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
