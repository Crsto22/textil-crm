import type { PageResponse, ProductoDetalleVariante } from "@/lib/types/producto"

export type TipoOfertaAplicada = "NINGUNA" | "GLOBAL" | "SUCURSAL"

export interface ProductoVarianteOferta extends ProductoDetalleVariante {
  productoId: number
  productoNombre: string
  sucursalId: number | null
  sucursalNombre: string | null
  imageUrl: string | null
  precioVigente: number | null
  tipoOfertaAplicada: TipoOfertaAplicada | null
  sucursalOfertaId: number | null
  usuarioCreacionId: number | null
  usuarioCreacionNombre: string | null
  usuarioCreacionCorreo: string | null
  ofertaHastaAgotarStock: boolean
}

export type ProductoVarianteOfertaPageResponse = PageResponse<ProductoVarianteOferta>

export interface ProductoVarianteOfertaLoteItemRequest {
  idProductoVariante: number
  precioOferta: number | null
  ofertaInicio: string | null
  ofertaFin: string | null
  ofertaHastaAgotarStock?: boolean
}

export interface ProductoVarianteOfertaLoteRequest {
  items: ProductoVarianteOfertaLoteItemRequest[]
}

export interface ProductoVarianteOfertaSucursalItemRequest {
  idProductoVariante: number
  idSucursal: number
  precioOferta: number | null
  ofertaInicio: string | null
  ofertaFin: string | null
}

export interface ProductoVarianteOfertaSucursalLoteRequest {
  items: ProductoVarianteOfertaSucursalItemRequest[]
}

export type OfertaBatchPriceMode =
  | "PRECIO_FIJO"
  | "DESCUENTO_PORCENTAJE"
  | "DESCUENTO_MONTO"

export type OfertaBatchSchedulePreset =
  | "PERSONALIZADO"
  | "HOY"
  | "TRES_DIAS"
  | "SIETE_DIAS"

export interface OfertaFormDraft {
  precioOfertaInput: string
  ofertaInicioInput: string
  ofertaFinInput: string
}

export interface OfertaBulkFormDraft extends OfertaFormDraft {
  priceMode: OfertaBatchPriceMode
  priceInput: string
  schedulePreset: OfertaBatchSchedulePreset
}

export interface OfertaBatchDraftItem extends ProductoVarianteOfertaLoteItemRequest {
  productoId: number
  productoNombre: string
  sku: string
  colorNombre: string
  tallaNombre: string
  imageUrl?: string | null
  precio: number
  modo: "CREAR" | "ACTUALIZAR"
}
