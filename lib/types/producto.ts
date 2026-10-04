// Tipos para el modulo de Productos

export interface Producto {
  idProducto: number
  sku: string
  nombre: string
  descripcion: string
  imagenGlobalUrl: string | null
  imagenGlobalThumbUrl: string | null
  guiaTallasUrl: string | null
  guiaTallasThumbUrl: string | null
  publicarEcommerce: boolean
  preventa: boolean
  fechaEnvioPreventa: string | null
  estado: string
  fechaCreacion: string
  idCategoria: number | null
  nombreCategoria: string
  idSucursal: number | null
  nombreSucursal: string | null
}

export interface ProductoResumenImagen {
  url: string
  urlThumb: string
  orden: number
  esPrincipal: boolean
}

export interface StockSucursalVenta {
  idSucursal: number
  nombreSucursal: string
  stock: number
}

export interface ProductoVarianteStockSucursalRequest {
  idSucursal: number
  cantidad: number
}

export interface ProductoVarianteStockSucursalDetalle {
  idSucursal: number
  nombreSucursal: string
  tipoSucursal: string
  cantidad: number
}

export interface ProductoResumenColor {
  colorId: number
  nombre: string
  hex: string | null
  imagenPrincipal: ProductoResumenImagen | null
  tallas: ProductoResumenTalla[]
}

export interface ProductoResumenTalla {
  idProductoVariante?: number | null
  tallaId: number
  nombre: string
  sku?: string | null
  codigoBarras?: string | null
  precio?: number | null
  precioMayor?: number | null
  precioOferta?: number | null
  ofertaInicio?: string | null
  ofertaFin?: string | null
  stock?: number | null
  stocksSucursalesVenta?: StockSucursalVenta[]
  estado?: string | null
}

export interface ProductoResumen extends Producto {
  precioMin?: number | null
  precioMax?: number | null
  colores: ProductoResumenColor[]
}

export interface ProductoCreateRequest {
  idSucursal?: number | null
  idCategoria: number | null
  nombre: string
  descripcion: string
  imagenGlobalUrl?: string | null
  imagenGlobalThumbUrl?: string | null
  guiaTallasUrl?: string | null
  guiaTallasThumbUrl?: string | null
  publicarEcommerce?: boolean
  preventa?: boolean
  fechaEnvioPreventa?: string | null
}

export interface ProductoVarianteCreateRequest {
  idProductoVariante?: number | null
  colorId: number
  tallaId: number
  estado?: "ACTIVO" | "INACTIVO" | string
  sku: string
  codigoBarras?: string | null
  precio: number
  precioMayor?: number | null
  precioOferta?: number | null
  ofertaInicio?: string | null
  ofertaFin?: string | null
  stocksSucursales: ProductoVarianteStockSucursalRequest[]
}

export interface ProductoImagenCreateRequest {
  colorId: number
  orden: number
  esPrincipal?: boolean
  url: string
  urlThumb: string
}

export interface ProductoInsertarCompletoRequest {
  idCategoria: number
  nombre: string
  descripcion?: string
  imagenGlobalUrl?: string | null
  imagenGlobalThumbUrl?: string | null
  guiaTallasUrl?: string | null
  guiaTallasThumbUrl?: string | null
  publicarEcommerce?: boolean
  preventa?: boolean
  fechaEnvioPreventa?: string | null
  variantes: ProductoVarianteCreateRequest[]
  imagenes: ProductoImagenCreateRequest[]
}

export interface ProductoImagenUploadResponseItem {
  url: string
  urlThumb: string
  ordenSugerido: number
}

export interface ProductoImagenesUploadResponse {
  colorId: number
  imagenes: ProductoImagenUploadResponseItem[]
}

export interface ProductoImagenGlobalUploadResponse {
  url: string
  urlThumb: string
}

export interface ProductoImportResponse {
  filasProcesadas: number
  productosCreados: number
  productosActualizados: number
  variantesGuardadas: number
  categoriasCreadas?: number
  coloresCreados: number
  tallasCreadas: number
}

export interface ProductoImportConfigRequest {
  idSucursalDestino: number | null
  nombreSucursalDestino: string | null
}

export interface ProductoImportVarianteRequest {
  colorNombre: string
  colorHex?: string
  tallaNombre: string
  sku: string
  codigoBarras: string
  precio: string
  precioMayor: string
  stock: string
}

export interface ProductoImportProductoRequest {
  nombreProducto: string
  categoriaNombre: string
  descripcion: string
  variantes: ProductoImportVarianteRequest[]
}

export interface ProductoImportValoresNuevosRequest {
  missingCategorias: string[]
  missingColores: string[]
  missingTallas: string[]
  savedColorHexes: Record<string, string>
}

export interface ProductoImportRequest {
  configuracionImportacion: ProductoImportConfigRequest
  productos: ProductoImportProductoRequest[]
  valoresNuevosDetectados: ProductoImportValoresNuevosRequest
}

export interface ProductoImportacionHistorial {
  idImportacion: number
  idUsuario: number | null
  nombreUsuario: string
  idSucursal: number | null
  nombreSucursal: string
  nombreArchivo: string
  tamanoBytes: number
  filasProcesadas: number
  productosCreados: number
  productosActualizados: number
  variantesGuardadas: number
  categoriasCreadas: number
  coloresCreados: number
  tallasCreadas: number
  estado: string
  mensajeError: string | null
  duracionMs: number | null
  createdAt: string
}

export interface ProductoInsertarCompletoResponse {
  producto: Producto
  variantes: number
  imagenes: number
}

export interface ProductoDetalleVariante {
  idProductoVariante: number
  sku: string
  codigoBarras?: string | null
  colorId: number
  colorNombre: string
  colorHex: string
  tallaId: number
  tallaNombre: string
  precio: number
  precioMayor: number | null
  precioOferta: number | null
  ofertaInicio: string | null
  ofertaFin: string | null
  stock: number
  stocksSucursales: ProductoVarianteStockSucursalDetalle[]
  estado: string
}

export interface ProductoDetalleImagen {
  idColorImagen: number
  colorId: number
  colorNombre: string
  colorHex: string
  url: string
  urlThumb: string
  orden: number
  esPrincipal: boolean
  estado: string
}

export interface ProductoDetalleResponse {
  producto: Producto
  variantes: ProductoDetalleVariante[]
  imagenes: ProductoDetalleImagen[]
}

export interface ProductoActualizarCompletoResponse {
  producto: Producto
  variantes: number
  imagenes: number
}

export interface ProductoUpdateRequest {
  idSucursal?: number | null
  idCategoria: number | null
  nombre: string
  descripcion: string
  imagenGlobalUrl?: string | null
  imagenGlobalThumbUrl?: string | null
  guiaTallasUrl?: string | null
  guiaTallasThumbUrl?: string | null
  publicarEcommerce?: boolean
  preventa?: boolean
  fechaEnvioPreventa?: string | null
}

export interface ProductoDeleteResponse {
  message: string
}

/**
 * Respuesta paginada generica del backend (Spring Boot Page<T>).
 */
export interface PageResponse<T> {
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
