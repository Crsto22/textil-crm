import type {
  Producto,
  ProductoDetalleImagen,
  ProductoDetalleResponse,
  ProductoDetalleVariante,
} from "@/lib/types/producto"
import { resolveBackendUrl } from "@/lib/resolve-backend-url"
import { parseProductoVarianteStocksSucursales } from "@/lib/stock-sucursal"

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function stringOr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function booleanOr(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
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
      return source[key] as string
    }
  }

  return null
}

function parseProducto(value: unknown): Producto | null {
  const payload = asRecord(value)
  const idProducto = pickNumber(payload, ["idProducto"])
  if (idProducto <= 0) return null

  const categoria = asRecord(payload?.categoria)
  const sucursal = asRecord(payload?.sucursal)

  return {
    idProducto,
    sku: pickString(payload, ["sku"]),
    nombre: pickString(payload, ["nombre"], "Producto"),
    descripcion: pickString(payload, ["descripcion"]),
    imagenGlobalUrl: pickNullableString(payload, ["imagenGlobalUrl"]),
    imagenGlobalThumbUrl: pickNullableString(payload, ["imagenGlobalThumbUrl"]),
    guiaTallasUrl: pickNullableString(payload, ["guiaTallasUrl"]),
    guiaTallasThumbUrl: pickNullableString(payload, ["guiaTallasThumbUrl"]),
    publicarEcommerce: payload?.publicarEcommerce === true,
    preventa: payload?.preventa === true,
    fechaEnvioPreventa: pickNullableString(payload, ["fechaEnvioPreventa"]),
    estado: pickString(payload, ["estado"], "ACTIVO"),
    fechaCreacion: pickString(payload, ["fechaCreacion", "createdAt"]),
    idCategoria:
      pickNullableNumber(payload, ["idCategoria"]) ??
      pickNullableNumber(categoria, ["idCategoria"]),
    nombreCategoria:
      pickString(payload, ["nombreCategoria"]) ||
      pickString(categoria, ["nombre"], "Sin categoria"),
    idSucursal:
      pickNullableNumber(payload, ["idSucursal"]) ??
      pickNullableNumber(sucursal, ["idSucursal"]),
    nombreSucursal:
      pickNullableString(payload, ["nombreSucursal"]) ??
      pickNullableString(sucursal, ["nombreSucursal", "nombre"]),
  }
}

export function parseProductoDetalleVariante(value: unknown): ProductoDetalleVariante | null {
  const payload = asRecord(value)
  if (!payload) return null

  const color = asRecord(payload.color)
  const talla = asRecord(payload.talla)

  const idProductoVariante = pickNumber(payload, ["idProductoVariante"])
  if (idProductoVariante <= 0) return null

  const colorId =
    pickNullableNumber(payload, ["colorId", "idColor"]) ??
    pickNullableNumber(color, ["idColor"]) ??
    0
  const tallaId =
    pickNullableNumber(payload, ["tallaId", "idTalla"]) ??
    pickNullableNumber(talla, ["idTalla"]) ??
    0

  return {
    idProductoVariante,
    sku: pickString(payload, ["sku"]),
    codigoBarras: pickNullableString(payload, ["codigoBarras"]),
    colorId,
    colorNombre:
      pickString(payload, ["colorNombre", "nombreColor"]) ||
      pickString(color, ["nombre"]) ||
      pickString(payload, ["color"], colorId > 0 ? `Color #${colorId}` : "Sin color"),
    colorHex:
      pickString(payload, ["colorHex", "hexColor", "hex"]) ||
      pickString(color, ["codigo", "hex"]),
    tallaId,
    tallaNombre:
      pickString(payload, ["tallaNombre", "nombreTalla"]) ||
      pickString(talla, ["nombre"]) ||
      pickString(payload, ["talla"], tallaId > 0 ? `Talla #${tallaId}` : "Sin talla"),
    precio: pickNumber(payload, ["precio", "precioUnitario"]),
    precioMayor: pickNullableNumber(payload, ["precioMayor"]),
    precioOferta: pickNullableNumber(payload, ["precioOferta"]),
    ofertaInicio: pickNullableString(payload, ["ofertaInicio"]),
    ofertaFin: pickNullableString(payload, ["ofertaFin"]),
    stock: pickNumber(payload, ["stock"]),
    stocksSucursales: parseProductoVarianteStocksSucursales(
      payload.stocksSucursales
    ),
    estado: pickString(payload, ["estado"], "ACTIVO"),
  }
}

export function parseProductoDetalleImagen(value: unknown): ProductoDetalleImagen | null {
  const payload = asRecord(value)
  if (!payload) return null

  const color = asRecord(payload.color)
  const idColorImagen = pickNumber(payload, ["idColorImagen"])
  if (idColorImagen <= 0) return null

  const colorId =
    pickNullableNumber(payload, ["colorId", "idColor"]) ??
    pickNullableNumber(color, ["idColor"]) ??
    0

  return {
    idColorImagen,
    colorId,
    colorNombre:
      pickString(payload, ["colorNombre", "nombreColor"]) ||
      pickString(color, ["nombre"], colorId > 0 ? `Color #${colorId}` : "Sin color"),
    colorHex:
      pickString(payload, ["colorHex", "hexColor", "hex"]) ||
      pickString(color, ["codigo", "hex"]),
    url: pickString(payload, ["url"]),
    urlThumb: pickString(payload, ["urlThumb"]),
    orden: pickNumber(payload, ["orden"]),
    esPrincipal: booleanOr(payload.esPrincipal),
    estado: pickString(payload, ["estado"], "ACTIVO"),
  }
}

function parseProductoDetalleVarianteList(value: unknown): ProductoDetalleVariante[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => parseProductoDetalleVariante(item))
    .filter((item): item is ProductoDetalleVariante => item !== null)
}

function parseProductoDetalleImagenList(value: unknown): ProductoDetalleImagen[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => parseProductoDetalleImagen(item))
    .filter((item): item is ProductoDetalleImagen => item !== null)
}

export function parseProductoDetalleResponse(value: unknown): ProductoDetalleResponse | null {
  const payload = asRecord(value)
  if (!payload) return null

  const producto = parseProducto(payload.producto)
  if (!producto) return null

  return {
    producto,
    variantes: parseProductoDetalleVarianteList(payload.variantes),
    imagenes: parseProductoDetalleImagenList(payload.imagenes),
  }
}

export function toProductoDetalleVarianteList(payload: unknown): ProductoDetalleVariante[] {
  if (Array.isArray(payload)) {
    return parseProductoDetalleVarianteList(payload)
  }

  const data = asRecord(payload)
  if (!data) return []

  if (Array.isArray(data.content)) {
    return parseProductoDetalleVarianteList(data.content)
  }

  if (Array.isArray(data.variantes)) {
    return parseProductoDetalleVarianteList(data.variantes)
  }

  return []
}

export function sortProductoDetalleVariantes(
  variants: ProductoDetalleVariante[]
): ProductoDetalleVariante[] {
  return [...variants].sort((a, b) => {
    if (a.colorNombre !== b.colorNombre) {
      return a.colorNombre.localeCompare(b.colorNombre)
    }
    if (a.tallaNombre !== b.tallaNombre) {
      return a.tallaNombre.localeCompare(b.tallaNombre)
    }
    return a.idProductoVariante - b.idProductoVariante
  })
}

export function getPrimaryImageUrlForColor(
  images: ProductoDetalleImagen[],
  colorId: number | null | undefined
): string | null {
  if (!Number.isFinite(colorId) || (colorId ?? 0) <= 0) {
    return null
  }

  const selectedImage =
    [...images]
      .filter((image) => image.colorId === colorId)
      .sort((a, b) => {
        if (a.esPrincipal !== b.esPrincipal) return a.esPrincipal ? -1 : 1
        return a.orden - b.orden
      })[0] ?? null

  const imageUrl =
    resolveBackendUrl(stringOr(selectedImage?.url).trim()) ||
    resolveBackendUrl(stringOr(selectedImage?.urlThumb).trim()) ||
    stringOr(selectedImage?.url).trim() ||
    stringOr(selectedImage?.urlThumb).trim()
  return imageUrl || null
}

export function getPrimaryImageUrlForVariant(
  images: ProductoDetalleImagen[],
  variant: Pick<ProductoDetalleVariante, "colorId"> | null | undefined
): string | null {
  return getPrimaryImageUrlForColor(images, variant?.colorId)
}

export function getPrimaryImageUrlFromResumen(
  product: { colores?: Array<{ colorId: number; imagenPrincipal?: { url?: string | null; urlThumb?: string | null } | null }> } | null | undefined,
  colorId: number | null | undefined
): string | null {
  if (!product?.colores || !Number.isFinite(colorId) || (colorId ?? 0) <= 0) {
    return null
  }

  const selectedColor = product.colores.find((color) => color.colorId === colorId)
  const imageUrl =
    resolveBackendUrl(nullableString(selectedColor?.imagenPrincipal?.url)?.trim()) ||
    resolveBackendUrl(nullableString(selectedColor?.imagenPrincipal?.urlThumb)?.trim()) ||
    nullableString(selectedColor?.imagenPrincipal?.url)?.trim() ||
    nullableString(selectedColor?.imagenPrincipal?.urlThumb)?.trim() ||
    ""

  return imageUrl || null
}
