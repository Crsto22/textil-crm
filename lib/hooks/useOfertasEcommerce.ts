"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth/auth-fetch"
import { parseProductoVarianteOferta } from "@/lib/oferta-parser"
import { obtenerEstadoVigenciaOferta } from "@/lib/oferta-utils"
import type { ProductoVarianteOferta } from "@/lib/types/oferta"

export interface ProductoOfertaAgrupada {
  productoId: number
  productoNombre: string
  imageUrl: string | null
  variantesConOferta: number
  totalVariantes: number
  precioNormalMin: number | null
  precioNormalMax: number | null
  precioOfertaMin: number | null
  precioOfertaMax: number | null
  descuentoPromedio: number | null
  fechaInicio: string | null
  fechaFin: string | null
  hastaAgotarStock: boolean
  estado: string
  varianteIds: number[]
}

interface ProductDetailResponse {
  producto?: {
    idProducto: number
    nombre: string
    imagenGlobalUrl?: string | null
    imagenGlobalThumbUrl?: string | null
  }
  variantes?: Array<{
    idProductoVariante: number
    precio: number
    precioOferta?: number | null
    ofertaInicio?: string | null
    ofertaFin?: string | null
    ofertaHastaAgotarStock?: boolean
  }>
}

function parseJsonSafe(response: Response) {
  return response.json().catch(() => null)
}

function agruparOfertas(variants: ProductoVarianteOferta[]): ProductoOfertaAgrupada[] {
  const groups = new Map<number, ProductoVarianteOferta[]>()

  for (const variant of variants) {
    const list = groups.get(variant.productoId) ?? []
    list.push(variant)
    groups.set(variant.productoId, list)
  }

  return Array.from(groups.values()).map((items) => {
    const preciosNormales = items.map((v) => v.precio).filter((p) => typeof p === "number" && Number.isFinite(p))
    const preciosOferta = items.map((v) => v.precioOferta).filter((p): p is number => typeof p === "number" && p !== null && Number.isFinite(p))

    let descuentoPromedio: number | null = null
    const descuentos = items
      .filter((v) => v.precioOferta !== null && typeof v.precioOferta === "number" && v.precioOferta > 0 && v.precioOferta < v.precio)
      .map((v) => Math.round(((v.precio - (v.precioOferta as number)) / v.precio) * 100))

    if (descuentos.length > 0) {
      descuentoPromedio = Math.round(descuentos.reduce((a, b) => a + b, 0) / descuentos.length)
    }

    const fechasInicio = items
      .map((v) => v.ofertaInicio)
      .filter((f): f is string => typeof f === "string" && f.trim() !== "")
      .sort()

    const fechasFin = items
      .map((v) => v.ofertaFin)
      .filter((f): f is string => typeof f === "string" && f.trim() !== "")
      .sort()

    const estados = items
      .map((v) => obtenerEstadoVigenciaOferta(v))
      .filter((e) => e !== "sin-oferta" && e !== "invalida")

    let estadoAgrupado = "sin-oferta"
    if (estados.includes("activa")) estadoAgrupado = "activa"
    else if (estados.includes("programada")) estadoAgrupado = "programada"
    else if (estados.includes("vencida")) estadoAgrupado = "vencida"
    else if (estados.includes("indefinida")) estadoAgrupado = "indefinida"

    return {
      productoId: items[0].productoId,
      productoNombre: items[0].productoNombre,
      imageUrl: items[0].imageUrl,
      variantesConOferta: preciosOferta.length,
      totalVariantes: items.length,
      precioNormalMin: preciosNormales.length > 0 ? Math.min(...preciosNormales) : null,
      precioNormalMax: preciosNormales.length > 0 ? Math.max(...preciosNormales) : null,
      precioOfertaMin: preciosOferta.length > 0 ? Math.min(...preciosOferta) : null,
      precioOfertaMax: preciosOferta.length > 0 ? Math.max(...preciosOferta) : null,
      descuentoPromedio,
      fechaInicio: fechasInicio.length > 0 ? fechasInicio[0] : null,
      fechaFin: fechasFin.length > 0 ? fechasFin[fechasFin.length - 1] : null,
      hastaAgotarStock: items.some((item) => item.ofertaHastaAgotarStock),
      estado: estadoAgrupado,
      varianteIds: items.map((v) => v.idProductoVariante),
    }
  })
}

export function useOfertasEcommerce() {
  const [ofertas, setOfertas] = useState<ProductoOfertaAgrupada[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchOfertas = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)

    try {
      const allVariants: ProductoVarianteOferta[] = []
      let page = 0
      let hasMore = true

      while (hasMore && !controller.signal.aborted && page < 50) {
        const response = await authFetch(`/api/variante/ofertas?page=${page}`, {
          signal: controller.signal,
          cache: "no-store",
        })
        const data = await parseJsonSafe(response)

        if (!response.ok) break

        const content: unknown[] = Array.isArray(data?.content) ? data.content : []
        const parsed = content
          .map((item: unknown) => parseProductoVarianteOferta(item))
          .filter((item): item is ProductoVarianteOferta => item !== null)

        allVariants.push(...parsed)

        const totalPages = Number(data?.totalPages ?? 0)
        hasMore = page + 1 < totalPages && parsed.length > 0
        page++
      }

      if (!controller.signal.aborted) {
        setOfertas(agruparOfertas(allVariants))
      }
    } catch {
      if (!controller.signal.aborted) {
        setOfertas([])
        toast.error("No se pudieron cargar las ofertas")
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void fetchOfertas()
    })
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [fetchOfertas])

  const crearOfertaProducto = useCallback(async (
    productoId: number,
    mode: "PRECIO_FIJO" | "DESCUENTO_PORCENTAJE",
    value: number,
    fechaInicio: string,
    fechaFin: string,
    hastaAgotarStock = false,
  ) => {
    setSaving(true)

    try {
      const detailRes = await authFetch(`/api/producto/detalle/${productoId}`, { cache: "no-store" })
      const detail = await parseJsonSafe(detailRes) as ProductDetailResponse | null

      if (!detailRes.ok || !detail?.variantes?.length) {
        toast.error("No se pudieron cargar las variantes del producto")
        return false
      }

      const items = detail.variantes.map((variante) => {
        let precioOferta = value
        if (mode === "DESCUENTO_PORCENTAJE") {
          precioOferta = Math.round((variante.precio * (1 - value / 100) + Number.EPSILON) * 100) / 100
        }

        return {
          idProductoVariante: variante.idProductoVariante,
          precioOferta: precioOferta > 0 && precioOferta < variante.precio ? precioOferta : null,
          ofertaInicio: fechaInicio || null,
          ofertaFin: fechaFin || null,
          ofertaHastaAgotarStock: hastaAgotarStock,
        }
      }).filter((item) => item.precioOferta !== null)

      if (items.length === 0) {
        toast.error("El precio de oferta debe ser menor al precio regular en todas las variantes")
        return false
      }

      const batchRes = await authFetch("/api/variante/ofertas/lote", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })

      const batchData = await parseJsonSafe(batchRes)

      if (!batchRes.ok) {
        const message = batchData && typeof batchData === "object" && "message" in batchData && typeof batchData.message === "string"
          ? batchData.message
          : "No se pudo crear la oferta"
        toast.error(message)
        return false
      }

      toast.success(`Oferta creada para ${items.length} variantes`)
      await fetchOfertas()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear la oferta")
      return false
    } finally {
      setSaving(false)
    }
  }, [fetchOfertas])

  const eliminarOfertaProducto = useCallback(async (oferta: ProductoOfertaAgrupada) => {
    const items = oferta.varianteIds.map((idProductoVariante) => ({
      idProductoVariante,
      precioOferta: null,
      ofertaInicio: null,
      ofertaFin: null,
      ofertaHastaAgotarStock: false,
    }))

    const response = await authFetch("/api/variante/ofertas/lote", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })

    const data = await parseJsonSafe(response)

    if (!response.ok) {
      const message = data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "No se pudo eliminar la oferta"
      toast.error(message)
      return
    }

    toast.success("Oferta eliminada")
    await fetchOfertas()
  }, [fetchOfertas])

  return {
    ofertas,
    loading,
    saving,
    fetchOfertas,
    crearOfertaProducto,
    eliminarOfertaProducto,
  }
}
