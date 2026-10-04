import { parseProductoDetalleVariante } from "@/lib/producto-detalle"
import type {
  ProductoVarianteOferta,
  ProductoVarianteOfertaPageResponse,
  TipoOfertaAplicada,
} from "@/lib/types/oferta"

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function pickNumber(source: Record<string, unknown> | null, keys: string[], fallback = 0) {
  if (!source) return fallback

  for (const key of keys) {
    const parsed = Number(source[key])
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function pickNullableNumber(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) return null

  for (const key of keys) {
    if (source[key] === null || source[key] === undefined || source[key] === "") continue
    const parsed = Number(source[key])
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function pickString(
  source: Record<string, unknown> | null,
  keys: string[],
  fallback = ""
): string {
  if (!source) return fallback

  for (const key of keys) {
    if (typeof source[key] === "string") {
      return source[key] as string
    }
  }

  return fallback
}

function pickNullableString(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) return null

  for (const key of keys) {
    if (typeof source[key] === "string") {
      const value = source[key].trim()
      return value === "" ? null : value
    }
  }

  return null
}

function pickBoolean(source: Record<string, unknown> | null, key: string, fallback = false) {
  if (!source || typeof source[key] !== "boolean") {
    return fallback
  }

  return source[key] as boolean
}

const VALID_TIPO_OFERTA: ReadonlySet<string> = new Set(["NINGUNA", "GLOBAL", "SUCURSAL"])

function pickTipoOfertaAplicada(
  source: Record<string, unknown> | null,
  key: string
): TipoOfertaAplicada | null {
  if (!source) return null
  const value = source[key]
  if (typeof value === "string" && VALID_TIPO_OFERTA.has(value)) {
    return value as TipoOfertaAplicada
  }
  return null
}

export function parseProductoVarianteOferta(value: unknown): ProductoVarianteOferta | null {
  const payload = asRecord(value)
  const variante = parseProductoDetalleVariante(payload)

  if (!payload || !variante) return null

  return {
    ...variante,
    productoId: pickNumber(payload, ["productoId", "idProducto"]),
    productoNombre: pickString(
      payload,
      ["productoNombre", "nombreProducto"],
      "Producto sin nombre"
    ),
    sucursalId: pickNullableNumber(payload, ["sucursalId", "idSucursal"]),
    sucursalNombre: pickNullableString(payload, ["sucursalNombre", "nombreSucursal"]),
    imageUrl: pickNullableString(payload, ["imageUrl", "imagenUrl"]),
    precioVigente: pickNullableNumber(payload, ["precioVigente"]),
    tipoOfertaAplicada: pickTipoOfertaAplicada(payload, "tipoOfertaAplicada"),
    sucursalOfertaId: pickNullableNumber(payload, ["sucursalOfertaId"]),
    usuarioCreacionId: pickNullableNumber(payload, ["usuarioCreacionId"]),
    usuarioCreacionNombre: pickNullableString(payload, ["usuarioCreacionNombre"]),
    usuarioCreacionCorreo: pickNullableString(payload, ["usuarioCreacionCorreo"]),
    ofertaHastaAgotarStock: pickBoolean(payload, "ofertaHastaAgotarStock"),
  }
}

export function parseProductoVarianteOfertaList(value: unknown): ProductoVarianteOferta[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => parseProductoVarianteOferta(item))
    .filter((item): item is ProductoVarianteOferta => item !== null)
}

export function parseProductoVarianteOfertaPageResponse(
  value: unknown
): ProductoVarianteOfertaPageResponse {
  const payload = asRecord(value)

  return {
    content: parseProductoVarianteOfertaList(payload?.content),
    page: pickNumber(payload, ["page", "number"]),
    size: pickNumber(payload, ["size"]),
    totalPages: pickNumber(payload, ["totalPages"]),
    totalElements: pickNumber(payload, ["totalElements"]),
    numberOfElements: pickNumber(payload, ["numberOfElements"]),
    first: pickBoolean(payload, "first"),
    last: pickBoolean(payload, "last"),
    empty: pickBoolean(payload, "empty"),
  }
}
