"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BanknotesIcon,
  CheckCircleIcon,
  CheckIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PhotoIcon,
  PlusIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PriceSelectorDropdown, type PriceType } from "@/components/chat/PriceSelectorDropdown"
import { authFetch } from "@/lib/auth/auth-fetch"
import { isValidPeruvianMobile, normalizePeruvianMobile, sanitizePeruvianMobileInput } from "@/lib/crm/phone"

type DiscountMode = "none" | "percent" | "amount"
type SaleStep = "cart" | "payment"

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

interface ProductoResumenImagen {
  url: string | null
  urlThumb: string | null
  orden?: number | null
  esPrincipal?: boolean | null
}

interface StockSucursalVenta {
  idSucursal: number
  nombreSucursal: string
  stock?: number | null
  cantidad?: number | null
}

interface ProductoResumenTalla {
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

interface ProductoResumenColor {
  colorId: number
  nombre: string
  hex: string | null
  imagenPrincipal: ProductoResumenImagen | null
  tallas: ProductoResumenTalla[]
}

interface ProductoResumen {
  idProducto: number
  sku: string | null
  nombre: string
  descripcion: string | null
  imagenGlobalUrl: string | null
  imagenGlobalThumbUrl: string | null
  estado: string | null
  precioMin?: number | null
  precioMax?: number | null
  idCategoria: number | null
  nombreCategoria: string | null
  colores: ProductoResumenColor[]
}

interface ProductoDetalleVariante {
  idProductoVariante: number
  sku: string | null
  codigoBarras: string | null
  colorId: number
  colorNombre: string
  colorHex: string | null
  tallaId: number
  tallaNombre: string
  precio: number
  precioMayor: number | null
  precioOferta: number | null
  ofertaInicio: string | null
  ofertaFin: string | null
  stock: number | null
  stocksSucursales: { idSucursal: number; nombreSucursal: string; cantidad: number | null }[]
  estado: string | null
}

interface ProductoImagenDetalle {
  colorId: number | null
  colorNombre: string | null
  colorHex: string | null
  url: string | null
  urlThumb: string | null
  orden: number | null
  esPrincipal: boolean | null
}

interface ProductoDetalleResponse {
  producto: {
    idProducto: number
    nombre: string
    descripcion: string | null
    imagenGlobalUrl: string | null
    imagenGlobalThumbUrl: string | null
    nombreCategoria: string | null
  }
  variantes: ProductoDetalleVariante[]
  imagenes: ProductoImagenDetalle[]
}

interface CatalogResponse {
  content: ProductoResumen[]
  page: number
  totalPages: number
  totalElements: number
  last: boolean
}

interface SelectedProductVariant {
  idProductoVariante: number
  nombre: string
  sku: string | null
  color: string
  talla: string
  imageUrl: string | null
  stock: number
  cantidad: number
  priceType: PriceType
  precio: number
  prices: CartItem["prices"]
}

interface MetodoPago {
  idMetodoPago: number
  nombre: string
  requiereCodigoOperacion: boolean
  requiereFechaPago: boolean
  requiereHoraPago: boolean
  cuentas: { idMetodoPagoCuenta: number; numeroCuenta: string; titular?: string | null }[]
}

interface SaleOptionsResponse {
  idSucursal: number
  metodosPago: MetodoPago[]
}

interface PaymentRequestSummary {
  idPaymentRequest: number
  paymentMethod: string
  expectedAmount: number
  currency: string
  status: string
  expiresAt: string
  reservationStatus: string
  reviewExpiresAt: string | null
  evidenceId: number | null
  evidenceMessageId: number | null
  evidenceStatus: string | null
  advisorAccepted: boolean
  operationCode: string | null
  operationAt: string | null
  detectedAmount: number | null
  detectedProvider: string | null
}

interface AiSaleDraftItem {
  productId: number
  variantId: number
  productName: string
  sku: string | null
  color: string | null
  size: string | null
  quantity: number
  regularUnitPrice: number | null
  unitPrice: number
  stock: number
  imageUrl: string | null
  preventa: boolean
  fechaEnvioPreventa: string | null
}

interface AiSaleDraftPromotion {
  promotionId: number
  name: string
  rule: string
  regularPrice: number
  comboPrice: number
  discount: number
}

interface AiSaleDraft {
  id: number
  conversationId: number
  status: "BUILDING" | "AWAITING_CUSTOMER" | "AWAITING_CUSTOMER_DATA" | "READY_FOR_REVIEW" | "IMPORTED" | "PAYMENT_PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED"
  version: number
  customerConfirmed: boolean
  customerConfirmedAt: string | null
  paymentMethodId: number | null
  paymentMethod: string | null
  pendingCustomerName: string | null
  pendingCustomerPhone: string | null
  customerNameCurrent: string | null
  customerNameSuggested: string | null
  customerNameSuggestionStatus: "PENDING" | "APPLIED" | "DISMISSED" | null
  pendingPromotionId: number | null
  subtotal: number
  promotionDiscount: number
  total: number
  expiresAt: string
  warnings: string[]
  promotions: AiSaleDraftPromotion[]
  items: AiSaleDraftItem[]
}

function normalizeAiSaleDraft(value: unknown): AiSaleDraft | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<AiSaleDraft>
  if (typeof candidate.id !== "number" || typeof candidate.status !== "string") return null
  return {
    ...candidate,
    subtotal: Number(candidate.subtotal) || 0,
    promotionDiscount: Number(candidate.promotionDiscount) || 0,
    total: Number(candidate.total) || 0,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings : [],
    promotions: Array.isArray(candidate.promotions) ? candidate.promotions : [],
    items: Array.isArray(candidate.items) ? candidate.items : [],
  } as AiSaleDraft
}

interface CartItem {
  idProductoVariante: number
  nombre: string
  sku: string | null
  color: string
  talla: string
  imageUrl: string | null
  stock: number
  cantidad: number
  priceType: PriceType
  precio: number
  prices: { type: PriceType; label: string; value: number }[]
}

function draftItemsToCart(items: AiSaleDraftItem[]): CartItem[] {
  return items.map((item) => ({
    idProductoVariante: item.variantId,
    nombre: item.productName,
    sku: item.sku,
    color: item.color || "",
    talla: item.size || "",
    imageUrl: item.imageUrl,
    stock: item.stock,
    cantidad: item.quantity,
    priceType: "normal",
    precio: Number(item.unitPrice),
    prices: [{ type: "normal", label: "Precio confirmado", value: Number(item.unitPrice) }],
  }))
}

interface CrmQuickSalePanelFlowProps {
  conversationId: string
  context: QuickSaleContext
  selectedSucursalId: number | null
  selectedComprobanteId: number | null
  contactPhone: string
  onCompleted: (context: QuickSaleContext) => void
  onDraftChange?: (hasDraft: boolean) => void
  onPaymentPrepared?: () => void
  onCustomerChanged?: () => void
}

const IGV = 18

function money(value: number) {
  return `S/${value.toFixed(2)}`
}

function preorderShippingDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}

function paymentRequestLabel(status: string) {
  if (status === "READY_FOR_SALE") return "Comprobante registrado"
  if (status === "UNDER_REVIEW") return "Pendiente de validacion"
  if (status === "COMPLETED") return "Pago validado"
  if (status === "EXPIRED") return "Reserva vencida"
  if (status === "CANCELLED") return "Solicitud cancelada"
  return "Esperando captura del cliente"
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null)
  return data?.message || fallback
}

function normalizeHexColor(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return `#${trimmed}`
  return "#94a3b8"
}

function isActive(value: string | null | undefined) {
  return String(value || "ACTIVO").trim().toUpperCase() === "ACTIVO"
}

function offerIsActive(item: { precio?: number | null; precioOferta?: number | null; ofertaInicio?: string | null; ofertaFin?: string | null }) {
  const regular = Number(item.precio || 0)
  const offer = Number(item.precioOferta || 0)
  if (!(offer > 0) || (regular > 0 && offer >= regular)) return false
  const now = Date.now()
  const start = item.ofertaInicio ? new Date(item.ofertaInicio).getTime() : null
  const end = item.ofertaFin ? new Date(item.ofertaFin).getTime() : null
  if (start && Number.isFinite(start) && now < start) return false
  if (end && Number.isFinite(end) && now > end) return false
  return true
}

function getProductImage(product: ProductoResumen) {
  const colores = Array.isArray(product.colores) ? product.colores : []
  return (
    product.imagenGlobalUrl ||
    product.imagenGlobalThumbUrl ||
    colores.find((color) => color.imagenPrincipal)?.imagenPrincipal?.url ||
    colores.find((color) => color.imagenPrincipal)?.imagenPrincipal?.urlThumb ||
    null
  )
}

function getProductStock(product: ProductoResumen) {
  const colores = Array.isArray(product.colores) ? product.colores : []
  return colores.reduce(
    (sum, color) =>
      sum +
      (Array.isArray(color.tallas) ? color.tallas : []).reduce((subtotal, talla) => {
        if (!isActive(talla.estado)) return subtotal
        return subtotal + Math.max(0, Number(talla.stock || 0))
      }, 0),
    0,
  )
}

function getPriceRange(product: ProductoResumen) {
  const colores = Array.isArray(product.colores) ? product.colores : []
  const prices = colores
    .flatMap((color) => color.tallas)
    .filter((talla) => isActive(talla.estado))
    .map((talla) => (offerIsActive(talla) ? Number(talla.precioOferta) : Number(talla.precio || 0)))
    .filter((price) => Number.isFinite(price) && price > 0)
  if (prices.length === 0) return "S/0.00"
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? money(min) : `${money(min)} - ${money(max)}`
}

function isProductoResumen(item: ProductoResumen | unknown): item is ProductoResumen {
  return Boolean(
    item &&
      typeof item === "object" &&
      "idProducto" in item &&
      "nombre" in item &&
      Array.isArray((item as ProductoResumen).colores),
  )
}

function buildVariantPrices(item: ProductoDetalleVariante) {
  const regular = Number(item.precio || 0)
  const prices: CartItem["prices"] = [{ type: "normal", label: "Unidad", value: regular }]
  if (offerIsActive(item)) {
    prices.push({ type: "oferta", label: "Oferta", value: Number(item.precioOferta) })
  }
  if (Number(item.precioMayor || 0) > 0) {
    prices.push({ type: "mayor", label: "Mayor", value: Number(item.precioMayor) })
  }
  return prices
}

function defaultPrice(prices: CartItem["prices"]) {
  return prices.find((price) => price.type === "oferta") ?? prices[0]
}

function getVariantStock(item: ProductoDetalleVariante, idSucursal: number | null) {
  if (idSucursal) {
    const stock = item.stocksSucursales?.find((entry) => entry.idSucursal === idSucursal)
    if (stock) return Math.max(0, Number(stock.cantidad || 0))
  }
  return Math.max(0, Number(item.stock || 0))
}

function paymentIcon(name: string) {
  const key = name.trim().toUpperCase()
  if (key === "YAPE") return { src: "/img/yape-app-seeklogo.png", icon: <DevicePhoneMobileIcon className="h-5 w-5" /> }
  if (key === "PLIN") return { src: "/img/plin-seeklogo.png", icon: <DevicePhoneMobileIcon className="h-5 w-5" /> }
  if (key === "EFECTIVO") return { src: "/img/efectivo.png", icon: <BanknotesIcon className="h-5 w-5" /> }
  return { src: null, icon: <CreditCardIcon className="h-5 w-5" /> }
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function CrmQuickSalePanelFlow({
  conversationId,
  context,
  selectedSucursalId,
  selectedComprobanteId,
  contactPhone,
  onCompleted,
  onDraftChange,
  onPaymentPrepared,
  onCustomerChanged,
}: CrmQuickSalePanelFlowProps) {
  const [step, setStep] = useState<SaleStep>("cart")
  const [productDrawerOpen, setProductDrawerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [onlyOffers, setOnlyOffers] = useState(false)
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductoResumen | null>(null)
  const [options, setOptions] = useState<SaleOptionsResponse | null>(null)
  const [activePaymentRequest, setActivePaymentRequest] = useState<PaymentRequestSummary | null>(null)
  const [aiSaleDraft, setAiSaleDraft] = useState<AiSaleDraft | null>(null)
  const [aiDraftLoading, setAiDraftLoading] = useState(false)
  const [aiDraftDirty, setAiDraftDirty] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountMode, setDiscountMode] = useState<DiscountMode>("none")
  const [discountValue, setDiscountValue] = useState("")
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [operationCode, setOperationCode] = useState("")
  const [paymentDate, setPaymentDate] = useState(today)
  const [paymentTime, setPaymentTime] = useState("")
  const [backupPhone, setBackupPhone] = useState("")
  const [backupPhoneModalOpen, setBackupPhoneModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const previousSucursalRef = useRef<number | null>(selectedSucursalId)
  const restoredPaymentRequestRef = useRef<number | null>(null)

  const selectedComprobante = context.comprobantes.find((item) => item.idComprobante === selectedComprobanteId) ?? null
  const selectedMethod = options?.metodosPago.find((item) => item.idMetodoPago === selectedMethodId) ?? null
  const normalizedPhone = normalizePeruvianMobile(context.cliente?.telefono || context.contactPhone || contactPhone)
  const hasDraft = cart.length > 0
  const reservedPaymentReady = activePaymentRequest?.status === "READY_FOR_SALE"
  const cartLocked = reservedPaymentReady || aiSaleDraft?.status === "IMPORTED"

  useEffect(() => {
    onDraftChange?.(hasDraft)
  }, [hasDraft, onDraftChange])

  useEffect(() => {
    if (previousSucursalRef.current === selectedSucursalId) return
    previousSucursalRef.current = selectedSucursalId
    setCart([])
    setStep("cart")
    setProductDrawerOpen(false)
    setSelectedMethodId(null)
  }, [selectedSucursalId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setBackupPhone(normalizedPhone), 0)
    return () => window.clearTimeout(timeoutId)
  }, [normalizedPhone])

  const loadCatalog = useCallback(async () => {
    if (!productDrawerOpen || !selectedSucursalId) return
    setCatalogLoading(true)
    try {
      const params = new URLSearchParams({
        idSucursal: String(selectedSucursalId),
        view: "productos",
        page: String(page),
        soloDisponibles: "true",
      })
      if (query.trim()) params.set("q", query.trim())
      if (onlyOffers) params.set("conOferta", "true")
      const response = await authFetch(
        `/api/crm/whatsapp/conversations/${conversationId}/sale-catalog?${params.toString()}`,
        { cache: "no-store" },
      )
      if (!response.ok) throw new Error(await readError(response, "No se pudo cargar catalogo"))
      setCatalog((await response.json()) as CatalogResponse)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar catalogo")
    } finally {
      setCatalogLoading(false)
    }
  }, [conversationId, onlyOffers, page, productDrawerOpen, query, selectedSucursalId])

  useEffect(() => {
    if (!productDrawerOpen) return
    const timeoutId = window.setTimeout(() => void loadCatalog(), 250)
    return () => window.clearTimeout(timeoutId)
  }, [loadCatalog, productDrawerOpen])

  useEffect(() => {
    if (!selectedSucursalId) return
    const loadOptions = async () => {
      try {
        const response = await authFetch(
          `/api/crm/whatsapp/conversations/${conversationId}/sale-options?idSucursal=${selectedSucursalId}`,
          { cache: "no-store" },
        )
        if (!response.ok) throw new Error(await readError(response, "No se pudo cargar pagos"))
        const data = (await response.json()) as SaleOptionsResponse
        setOptions(data)
        setSelectedMethodId(null)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al cargar pagos")
      }
    }
    void loadOptions()
  }, [conversationId, selectedSucursalId])

  const loadActivePaymentRequest = useCallback(async () => {
    const response = await authFetch(
      `/api/crm/whatsapp/conversations/${conversationId}/payment-requests/active`,
      { cache: "no-store" },
    )
    if (!response.ok || response.status === 204) {
      setActivePaymentRequest(null)
      return
    }

    const data = (await response.json().catch(() => null)) as PaymentRequestSummary | null
    const requestId = Number(data?.idPaymentRequest)
    const expectedAmount = Number(data?.expectedAmount)
    const isValidRequest = Boolean(
      data?.status
      && Number.isFinite(requestId)
      && requestId > 0
      && Number.isFinite(expectedAmount)
      && expectedAmount > 0,
    )

    setActivePaymentRequest(isValidRequest ? { ...data!, expectedAmount } : null)
  }, [conversationId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadActivePaymentRequest().catch(() => undefined), 0)
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: number }>).detail
      if (String(detail?.conversationId ?? "") === conversationId) {
        void loadActivePaymentRequest().catch(() => undefined)
      }
    }
    window.addEventListener("crm-payment-event", refresh)
    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener("crm-payment-event", refresh)
    }
  }, [conversationId, loadActivePaymentRequest])

  const loadAiSaleDraft = useCallback(async () => {
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/ai/sale-draft`, { cache: "no-store" })
      if (!response.ok) throw new Error(await readError(response, "No se pudo cargar el pedido de IA Kiments"))
      if (response.status === 204) {
        setAiSaleDraft(null)
        return
      }
      setAiSaleDraft(normalizeAiSaleDraft(await response.json()))
    } catch {
      setAiSaleDraft(null)
    }
  }, [conversationId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadAiSaleDraft(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadAiSaleDraft])

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: number }>).detail
      if (String(detail?.conversationId ?? "") === conversationId) void loadAiSaleDraft()
    }
    window.addEventListener("crm-ai-sale-draft-event", refresh)
    return () => window.removeEventListener("crm-ai-sale-draft-event", refresh)
  }, [conversationId, loadAiSaleDraft])

  const subtotal = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const rawDiscount = Number(discountValue.replace(",", ".")) || 0
  const discountAmount =
    discountMode === "percent"
      ? subtotal * (Math.min(100, Math.max(0, rawDiscount)) / 100)
      : discountMode === "amount"
        ? Math.min(subtotal, Math.max(0, rawDiscount))
        : 0
  const total = Math.max(0, subtotal - discountAmount)
  const igvAmount = total - total / (1 + IGV / 100)
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.cantidad, 0), [cart])

  const addSelectedVariant = (item: SelectedProductVariant) => {
    if (cartLocked) {
      toast.error("El pedido reservado no se puede modificar")
      return
    }
    if (item.stock <= 0) {
      toast.error("La variante no tiene stock disponible")
      return
    }
    if (aiSaleDraft?.status === "IMPORTED") setAiDraftDirty(true)
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.idProductoVariante === item.idProductoVariante)
      if (existing) {
        if (existing.cantidad + item.cantidad > item.stock) {
          toast.error("No puedes superar el stock disponible")
          return current
        }
        return current.map((cartItem) =>
          cartItem.idProductoVariante === item.idProductoVariante
            ? {
                ...cartItem,
                cantidad: cartItem.cantidad + item.cantidad,
                precio: item.precio,
                priceType: item.priceType,
                prices: item.prices,
                imageUrl: item.imageUrl || cartItem.imageUrl,
              }
            : cartItem,
        )
      }
      return [...current, item]
    })
  }

  const updateQty = (idProductoVariante: number, delta: number) => {
    if (cartLocked) {
      toast.error("El pedido reservado no se puede modificar")
      return
    }
    if (aiSaleDraft?.status === "IMPORTED") setAiDraftDirty(true)
    setCart((current) =>
      current.map((item) => {
        if (item.idProductoVariante !== idProductoVariante) return item
        return { ...item, cantidad: Math.min(item.stock, Math.max(1, item.cantidad + delta)) }
      }),
    )
  }

  const buildSalePayload = (pending: boolean) => {
    const fecha =
      !pending && selectedMethod && (selectedMethod.requiereFechaPago || selectedMethod.requiereHoraPago)
        ? `${paymentDate}T${paymentTime || "00:00"}:00`
        : null
    return {
      idSucursal: selectedSucursalId,
      idComprobante: selectedComprobanteId,
      moneda: "PEN",
      formaPago: "CONTADO",
      igvPorcentaje: IGV,
      descuentoTotal: discountAmount,
      tipoDescuento: discountMode === "percent" ? "PORCENTAJE" : discountMode === "amount" ? "MONTO" : null,
      telefonoRespaldo: normalizePeruvianMobile(backupPhone),
      aiSaleDraftId: aiSaleDraft?.status === "IMPORTED" ? aiSaleDraft.id : null,
      aiSaleDraftVersion: aiSaleDraft?.status === "IMPORTED" ? aiSaleDraft.version : null,
      detalles: cart.map((item) => ({
        idProductoVariante: item.idProductoVariante,
        descripcion: `${item.nombre} ${item.color} ${item.talla}`.trim(),
        cantidad: item.cantidad,
        unidadMedida: "NIU",
        codigoTipoAfectacionIgv: "10",
        precioUnitario: item.precio,
        descuento: 0,
      })),
      pagos: selectedMethod
        ? [{
            idMetodoPago: selectedMethod.idMetodoPago,
            monto: total,
            codigoOperacion: pending ? null : operationCode.trim() || null,
            fecha,
          }]
        : [],
    }
  }

  const importAiDraft = async () => {
    if (!aiSaleDraft) return
    if (cart.length > 0 && !window.confirm("Reemplazar el carrito actual por el pedido confirmado por el cliente?")) return
    setAiDraftLoading(true)
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/ai/sale-draft/revalidate`, {
        method: "POST",
        body: JSON.stringify({ markImported: true }),
      })
      if (!response.ok) throw new Error(await readError(response, "No se pudo cargar el pedido de IA Kiments"))
      const draft = normalizeAiSaleDraft(await response.json())
      if (!draft) throw new Error("El pedido de IA Kiments recibido no es valido")
      setAiSaleDraft(draft)
      setAiDraftDirty(false)
      setCart(draftItemsToCart(draft.items))
      setSelectedMethodId(null)
      setDiscountMode(draft.promotionDiscount > 0 ? "amount" : "none")
      setDiscountValue(draft.promotionDiscount > 0 ? String(draft.promotionDiscount) : "")
      setStep("cart")
      toast.success("Pedido de IA Kiments cargado en Venta Rapida")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el pedido de IA Kiments")
    } finally {
      setAiDraftLoading(false)
    }
  }

  useEffect(() => {
    if (!activePaymentRequest || activePaymentRequest.status !== "READY_FOR_SALE"
      || !activePaymentRequest.advisorAccepted || !aiSaleDraft) return
    if (restoredPaymentRequestRef.current === activePaymentRequest.idPaymentRequest) return
    const timeoutId = window.setTimeout(() => {
      restoredPaymentRequestRef.current = activePaymentRequest.idPaymentRequest
      setCart(draftItemsToCart(aiSaleDraft.items))
      setAiDraftDirty(false)
      setSelectedMethodId(null)
      setSelectedAccountId(null)
      onPaymentPrepared?.()
      setDiscountMode(aiSaleDraft.promotionDiscount > 0 ? "amount" : "none")
      setDiscountValue(aiSaleDraft.promotionDiscount > 0 ? String(aiSaleDraft.promotionDiscount) : "")
      setOperationCode(activePaymentRequest.operationCode || "")
      if (activePaymentRequest.operationAt) {
        setPaymentDate(activePaymentRequest.operationAt.slice(0, 10))
        setPaymentTime(activePaymentRequest.operationAt.slice(11, 16))
      }
      setStep("cart")
      toast.success("Comprobante registrado y pedido cargado en Venta Rapida")
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [activePaymentRequest, aiSaleDraft, onPaymentPrepared])

  useEffect(() => {
    restoredPaymentRequestRef.current = null
  }, [conversationId])

  const requestAiConfirmation = async () => {
    setAiDraftLoading(true)
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/ai/sale-draft/request-confirmation`, {
        method: "POST",
        body: JSON.stringify({
          items: cart.length > 0 ? cart.map((item) => ({ variantId: item.idProductoVariante, quantity: item.cantidad })) : null,
          paymentMethodId: selectedMethodId,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, "No se pudo solicitar confirmacion"))
      const draft = normalizeAiSaleDraft(await response.json())
      if (!draft) throw new Error("El pedido de IA Kiments recibido no es valido")
      setAiSaleDraft(draft)
      setAiDraftDirty(false)
      toast.success("Resumen enviado al cliente")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo solicitar confirmacion")
    } finally {
      setAiDraftLoading(false)
    }
  }

  const discardAiDraft = async () => {
    if (!window.confirm("Descartar el pedido preparado por IA Kiments?")) return
    setAiDraftLoading(true)
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/ai/sale-draft`, { method: "DELETE" })
      if (!response.ok) throw new Error(await readError(response, "No se pudo descartar el pedido"))
      setAiSaleDraft(null)
      setAiDraftDirty(false)
      toast.success("Pedido de IA Kiments descartado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descartar el pedido")
    } finally {
      setAiDraftLoading(false)
    }
  }

  const decideCustomerNameSuggestion = async (action: "APPLY" | "DISMISS") => {
    if (!aiSaleDraft || aiSaleDraft.customerNameSuggestionStatus !== "PENDING") return
    setAiDraftLoading(true)
    try {
      const response = await authFetch(
        `/api/crm/whatsapp/conversations/${conversationId}/ai/sale-draft/customer-name-suggestion`,
        { method: "POST", body: JSON.stringify({ action }) },
      )
      if (!response.ok) throw new Error(await readError(response, "No se pudo guardar la decision"))
      const draft = normalizeAiSaleDraft(await response.json())
      if (!draft) throw new Error("El pedido de IA Kiments recibido no es valido")
      setAiSaleDraft(draft)
      onCustomerChanged?.()
      toast.success(action === "APPLY" ? "Nombre del cliente actualizado" : "Se mantuvo el nombre actual")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la decision")
    } finally {
      setAiDraftLoading(false)
    }
  }

  const submitSale = async () => {
    if (aiSaleDraft?.status === "IMPORTED" && aiDraftDirty) {
      toast.error("Solicita una nueva confirmacion del cliente antes de emitir")
      return false
    }
    if (!selectedSucursalId || !selectedComprobanteId) {
      toast.error("Selecciona sucursal y comprobante")
      return false
    }
    if (cart.length === 0) {
      toast.error("Agrega al menos una variante")
      return false
    }
    if (!selectedMethod) {
      toast.error("Selecciona metodo de pago")
      return false
    }
    if (!context.cliente && !isValidPeruvianMobile(backupPhone)) {
      toast.error("Registra un celular peruano valido de 9 digitos")
      return false
    }
    if (selectedComprobante?.tipoComprobante?.toUpperCase() === "FACTURA") {
      const hasRuc = context.cliente?.tipoDocumento === "RUC" && /^\d{11}$/.test(context.cliente.nroDocumento || "")
      if (!hasRuc) {
        toast.error("La factura requiere un cliente con RUC valido")
        return false
      }
    }
    if (selectedMethod.requiereCodigoOperacion && !operationCode.trim()) {
      toast.error("Ingresa codigo de operacion")
      return false
    }
    if ((selectedMethod.requiereFechaPago || selectedMethod.requiereHoraPago) && (!paymentDate || !paymentTime)) {
      toast.error("Ingresa fecha y hora de pago")
      return false
    }

    setSubmitting(true)
    try {
      const endpoint = reservedPaymentReady && activePaymentRequest
        ? `/api/crm/whatsapp/payment-requests/${activePaymentRequest.idPaymentRequest}/sales`
        : `/api/crm/whatsapp/conversations/${conversationId}/sales`
      const response = await authFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(buildSalePayload(false)),
      })
      if (!response.ok) throw new Error(await readError(response, "No se pudo registrar la venta"))
      const data = (await response.json()) as { context: QuickSaleContext; venta?: { serie?: string; correlativo?: number } }
      setCart([])
      setActivePaymentRequest(null)
      setAiSaleDraft(null)
      setAiDraftDirty(false)
      setDiscountMode("none")
      setDiscountValue("")
      setStep("cart")
      toast.success(
        data.venta?.serie && data.venta?.correlativo
          ? `Venta registrada: ${data.venta.serie}-${data.venta.correlativo}`
          : "Venta registrada",
      )
      onCompleted(data.context)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la venta")
      void loadCatalog()
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="contents">
      <div className="flex min-h-0 flex-1 flex-col">
        {aiSaleDraft && aiSaleDraft.status !== "PAYMENT_PENDING" ? (
          <AiSaleDraftCard
            draft={aiSaleDraft}
            dirty={aiDraftDirty}
            loading={aiDraftLoading}
            onImport={() => void importAiDraft()}
            onRequestConfirmation={() => void requestAiConfirmation()}
            onDiscard={() => void discardAiDraft()}
            onCustomerNameDecision={(action) => void decideCustomerNameSuggestion(action)}
          />
        ) : null}
        {activePaymentRequest && Number.isFinite(activePaymentRequest.expectedAmount) && activePaymentRequest.expectedAmount > 0 ? (
          <div className="mb-2 rounded-xl border border-blue-200 px-3 py-2 text-[11px] text-slate-700 dark:border-blue-500/30 dark:text-slate-200">
            <p className="font-bold">Pago asistido por IA Kiments</p>
            <p>{paymentRequestLabel(activePaymentRequest.status)} · {money(Number(activePaymentRequest.expectedAmount))}</p>
            {activePaymentRequest.detectedProvider ? <p className="text-slate-400">Medio detectado: {activePaymentRequest.detectedProvider}</p> : null}
          </div>
        ) : null}
        {step === "payment" ? (
          <PaymentStep
            selectedComprobante={selectedComprobante}
            methods={options?.metodosPago ?? []}
            selectedMethod={selectedMethod}
            selectedMethodId={selectedMethodId}
            setSelectedMethodId={(value) => {
              setSelectedMethodId(value)
              if (aiSaleDraft?.status === "IMPORTED" && value !== aiSaleDraft.paymentMethodId) setAiDraftDirty(true)
              const method = options?.metodosPago.find((item) => item.idMetodoPago === value)
              setSelectedAccountId(method?.cuentas?.[0]?.idMetodoPagoCuenta ?? null)
            }}
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            operationCode={operationCode}
            setOperationCode={setOperationCode}
            paymentDate={paymentDate}
            setPaymentDate={setPaymentDate}
            paymentTime={paymentTime}
            setPaymentTime={setPaymentTime}
            total={total}
            submitting={submitting}
            onBack={() => setStep("cart")}
            onSubmit={() => {
              if (!context.cliente) {
                setBackupPhoneModalOpen(true)
                return
              }
              void submitSale()
            }}
          />
        ) : (
          <CartStep
            cart={cart}
            totalItems={totalItems}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            igvAmount={igvAmount}
            discountMode={discountMode}
            setDiscountMode={setDiscountMode}
            discountLocked={cartLocked}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            selectedComprobante={selectedComprobante}
            selectedSucursalId={selectedSucursalId}
            selectedComprobanteId={selectedComprobanteId}
            onOpenProducts={() => {
              if (cartLocked) toast.error("El pedido reservado no se puede modificar")
              else setProductDrawerOpen(true)
            }}
            onContinue={() => {
              if (aiSaleDraft?.status !== "IMPORTED") setSelectedMethodId(null)
              if (!reservedPaymentReady) {
                setOperationCode("")
                setPaymentDate(today())
                setPaymentTime("")
              }
              setStep("payment")
            }}
            onClear={() => {
              if (cartLocked) {
                toast.error("El pedido reservado no se puede modificar")
                return
              }
              if (aiSaleDraft?.status === "IMPORTED") setAiDraftDirty(true)
              setCart([])
            }}
            onUpdateQty={updateQty}
            onRemove={(id) => {
              if (cartLocked) {
                toast.error("El pedido reservado no se puede modificar")
                return
              }
              if (aiSaleDraft?.status === "IMPORTED") setAiDraftDirty(true)
              setCart((current) => current.filter((item) => item.idProductoVariante !== id))
            }}
            onPriceChange={(id, type) => {
              if (cartLocked) {
                toast.error("El pedido reservado no se puede modificar")
                return
              }
              if (aiSaleDraft?.status === "IMPORTED") setAiDraftDirty(true)
              setCart((current) =>
                current.map((item) => {
                  if (item.idProductoVariante !== id) return item
                  const price = item.prices.find((option) => option.type === type) ?? item.prices[0]
                  return { ...item, priceType: type, precio: price.value }
                }),
              )
            }}
            onEditPrice={(id, newPrice) => {
              if (cartLocked) {
                toast.error("El pedido reservado no se puede modificar")
                return
              }
              if (aiSaleDraft?.status === "IMPORTED") setAiDraftDirty(true)
              setCart((current) =>
                current.map((item) =>
                  item.idProductoVariante === id
                    ? { ...item, precio: newPrice, priceType: "editado" }
                    : item,
                ),
              )
            }}
          />
        )}
      </div>

      {productDrawerOpen ? (
        <ProductDrawer
          query={query}
          setQuery={(value) => {
            setQuery(value)
            setPage(0)
          }}
          page={page}
          setPage={setPage}
          onlyOffers={onlyOffers}
          setOnlyOffers={(value) => {
            setOnlyOffers(value)
            setPage(0)
          }}
          catalog={catalog}
          loading={catalogLoading}
          cart={cart}
          selectedSucursalId={selectedSucursalId}
          onAdd={setSelectedProduct}
          onClose={() => setProductDrawerOpen(false)}
        />
      ) : null}

      <ProductSelectionModal
        conversationId={conversationId}
        product={selectedProduct}
        selectedSucursalId={selectedSucursalId}
        onClose={() => setSelectedProduct(null)}
        onConfirm={(variant) => {
          addSelectedVariant(variant)
          setSelectedProduct(null)
        }}
      />

      <Dialog open={backupPhoneModalOpen} onOpenChange={setBackupPhoneModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-0">
          <DialogHeader className="border-b border-slate-100 px-4 pb-3 pt-4 text-left dark:border-slate-700/60">
            <DialogTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">Enlazar cliente</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Agrega un numero de celular para crear o enlazar el cliente antes de registrar la venta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-4 py-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Celular
            </label>
            <input
              value={backupPhone}
              onChange={(event) => setBackupPhone(sanitizePeruvianMobileInput(event.target.value))}
              placeholder="Ej. 932889985"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
            />
            <p className="text-[11px] text-slate-400">
              Se usara para buscar el cliente existente o crear CLIENTE {normalizePeruvianMobile(backupPhone) || "..."}.
            </p>
          </div>
          <DialogFooter className="gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-700/60">
            <Button type="button" variant="outline" className="h-9 rounded-xl text-xs" disabled={submitting} onClick={() => setBackupPhoneModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-9 rounded-xl text-xs font-bold"
              disabled={submitting || !isValidPeruvianMobile(backupPhone)}
              onClick={() => {
                void submitSale().then((completed) => {
                  if (completed) setBackupPhoneModalOpen(false)
                })
              }}
            >
              {submitting ? "Registrando..." : "Enlazar y vender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function AiSaleDraftCard({
  draft,
  dirty,
  loading,
  onImport,
  onRequestConfirmation,
  onDiscard,
  onCustomerNameDecision,
}: {
  draft: AiSaleDraft
  dirty: boolean
  loading: boolean
  onImport: () => void
  onRequestConfirmation: () => void
  onDiscard: () => void
  onCustomerNameDecision: (action: "APPLY" | "DISMISS") => void
}) {
  const ready = (draft.status === "READY_FOR_REVIEW" || draft.status === "IMPORTED") && !dirty
  const waitingCustomerData = draft.status === "AWAITING_CUSTOMER_DATA"
  const items = Array.isArray(draft.items) ? draft.items : []
  return (
    <div className="mb-2 border-y border-blue-200 bg-blue-50/70 px-3 py-2.5 dark:border-blue-500/25 dark:bg-blue-500/10">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <SparklesIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">Pedido preparado por IA Kiments</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${ready ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>
              {dirty ? "Cambios pendientes" : waitingCustomerData ? "Datos del cliente" : ready ? "Confirmado" : "Por confirmar"}
            </span>
          </div>
          <div className="mt-1 space-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
            {items.slice(0, 3).map((item) => (
              <div key={item.variantId}>
                <p className="truncate">{item.quantity} x {item.productName} {item.color || ""} {item.size ? `T. ${item.size}` : ""}</p>
                {item.preventa && item.fechaEnvioPreventa ? (
                  <p className="truncate font-semibold text-blue-700 dark:text-blue-300">
                    Preventa · envíos desde {preorderShippingDate(item.fechaEnvioPreventa)}
                  </p>
                ) : null}
              </div>
            ))}
            {items.length > 3 ? <p>+{items.length - 3} producto(s)</p> : null}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">{money(Number(draft.total))}</span>
            <span className="truncate text-[10px] font-semibold text-slate-500">{draft.paymentMethod || "Pago pendiente"}</span>
          </div>
          {draft.promotions.map((promotion) => (
            <div key={promotion.promotionId} className="mt-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              Combo {promotion.name}: -{money(Number(promotion.discount))}
            </div>
          ))}
          {draft.customerNameSuggestionStatus === "PENDING"
            && draft.customerNameCurrent
            && draft.customerNameSuggested ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
              <p>
                El cliente indico: <strong>{draft.customerNameSuggested}</strong>. En CRM figura:{" "}
                <strong>{draft.customerNameCurrent}</strong>.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-[10px] font-bold"
                  disabled={loading}
                  onClick={() => onCustomerNameDecision("APPLY")}
                >
                  Actualizar nombre
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-lg px-2 text-[10px] font-bold"
                  disabled={loading}
                  onClick={() => onCustomerNameDecision("DISMISS")}
                >
                  Mantener actual
                </Button>
              </div>
            </div>
          ) : null}
          {draft.warnings?.length ? <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{draft.warnings.join(". ")}</p> : null}
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
            {ready ? (
              <Button type="button" className="h-8 rounded-xl text-[10px] font-bold" disabled={loading || draft.status === "IMPORTED"} onClick={onImport}>
                {draft.status === "IMPORTED" ? "Cargado" : "Cargar en Venta Rapida"}
              </Button>
            ) : (
              <Button type="button" className="h-8 rounded-xl text-[10px] font-bold" disabled={loading || items.length === 0 || waitingCustomerData} onClick={onRequestConfirmation}>
                {waitingCustomerData ? "Esperando datos del cliente" : "Solicitar confirmacion"}
              </Button>
            )}
            <Button type="button" variant="outline" className="h-8 rounded-xl px-2 text-[10px]" disabled={loading} onClick={onDiscard}>
              Descartar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CartStep({
  cart,
  totalItems,
  subtotal,
  discountAmount,
  total,
  igvAmount,
  discountMode,
  setDiscountMode,
  discountLocked,
  discountValue,
  setDiscountValue,
  selectedComprobante,
  selectedSucursalId,
  selectedComprobanteId,
  onOpenProducts,
  onContinue,
  onClear,
  onUpdateQty,
  onRemove,
  onPriceChange,
  onEditPrice,
}: {
  cart: CartItem[]
  totalItems: number
  subtotal: number
  discountAmount: number
  total: number
  igvAmount: number
  discountMode: DiscountMode
  setDiscountMode: (value: DiscountMode) => void
  discountLocked: boolean
  discountValue: string
  setDiscountValue: (value: string) => void
  selectedComprobante: ComprobanteResumen | null
  selectedSucursalId: number | null
  selectedComprobanteId: number | null
  onOpenProducts: () => void
  onContinue: () => void
  onClear: () => void
  onUpdateQty: (id: number, delta: number) => void
  onRemove: (id: number) => void
  onPriceChange: (id: number, type: PriceType) => void
  onEditPrice: (id: number, newPrice: number) => void
}) {
  const [discountOpen, setDiscountOpen] = useState(false)
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null)
  const [priceDraft, setPriceDraft] = useState("")

  const startEditingPrice = (item: CartItem) => {
    setPriceDraft(item.precio.toFixed(2))
    setEditingPriceId(item.idProductoVariante)
  }

  const cancelEditingPrice = () => {
    setEditingPriceId(null)
    setPriceDraft("")
  }

  const confirmEditingPrice = (id: number) => {
    const parsed = parseFloat(priceDraft.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed < 0) {
      cancelEditingPrice()
      return
    }
    onEditPrice(id, Math.round(parsed * 100) / 100)
    cancelEditingPrice()
  }
  const hasDiscount = discountAmount > 0
  const showTaxBreakdown = ["FACTURA", "BOLETA"].includes(
    String(selectedComprobante?.tipoComprobante ?? "").trim().toUpperCase(),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Carrito</p>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{totalItems} item(s)</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            className={`h-9 w-9 rounded-full p-0 ${discountOpen || hasDiscount ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300" : ""}`}
            disabled={discountLocked}
            onClick={() => setDiscountOpen((value) => !value)}
            aria-label="Agregar descuento"
            title="Agregar descuento"
          >
            <TagIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            className="h-9 rounded-[20px] px-3 text-xs font-bold"
            disabled={!selectedSucursalId || !selectedComprobanteId}
            onClick={onOpenProducts}
          >
            <PlusIcon className="h-4 w-4" />
            Agregar producto
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-dashed border-slate-200 bg-transparent p-2 dark:border-slate-700/70">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[96px] flex-col items-center justify-center text-center text-xs text-slate-400">
            <ShoppingBagIcon className="mb-2 h-8 w-8 opacity-40" />
            Agrega productos para vender desde WhatsApp.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button type="button" onClick={onClear} className="text-[11px] font-semibold text-slate-400 hover:text-rose-500">
                Vaciar carrito
              </button>
            </div>
            {cart.map((item) => (
              <div key={item.idProductoVariante} className="rounded-xl border border-slate-100 bg-white p-2 dark:border-slate-700/60 dark:bg-slate-950/40">
                <div className="flex gap-2">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.nombre} fill unoptimized sizes="48px" className="object-cover" />
                    ) : (
                      <PhotoIcon className="m-3 h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{item.nombre}</p>
                    <p className="truncate text-[10px] text-slate-500">{item.color} · {item.talla}</p>
                    {editingPriceId === item.idProductoVariante ? (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">S/</span>
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.01"
                          value={priceDraft}
                          onChange={(event) => setPriceDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") confirmEditingPrice(item.idProductoVariante)
                            if (event.key === "Escape") cancelEditingPrice()
                          }}
                          onBlur={() => confirmEditingPrice(item.idProductoVariante)}
                          className="h-7 w-20 rounded-md border border-blue-400 bg-white px-1.5 text-xs font-bold tabular-nums text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-500 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onMouseDown={(event) => { event.preventDefault(); confirmEditingPrice(item.idProductoVariante) }}
                          className="flex items-center justify-center rounded-md p-0.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                          aria-label="Confirmar precio"
                        >
                          <CheckIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => { event.preventDefault(); cancelEditingPrice() }}
                          className="flex items-center justify-center rounded-md p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                          aria-label="Cancelar edicion de precio"
                        >
                          <XMarkIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                          {money(item.precio)}
                        </span>
                        <PriceSelectorDropdown
                          options={item.prices}
                          selectedType={item.priceType}
                          onSelect={(type) => onPriceChange(item.idProductoVariante, type)}
                          onEditPrice={() => startEditingPrice(item)}
                          triggerLabel={`Cambiar precio para ${item.nombre}`}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between">
                    <button type="button" onClick={() => onRemove(item.idProductoVariante)} className="text-slate-400 hover:text-rose-500">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                    <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                      <button type="button" onClick={() => onUpdateQty(item.idProductoVariante, -1)} className="flex h-6 w-6 items-center justify-center">
                        <MinusIcon className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold">{item.cantidad}</span>
                      <button type="button" onClick={() => onUpdateQty(item.idProductoVariante, 1)} className="flex h-6 w-6 items-center justify-center">
                        <PlusIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {discountOpen ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-2.5 dark:border-slate-700/60 dark:bg-slate-950/30">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Descuento</p>
              {hasDiscount ? (
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                  Aplicado: -{money(discountAmount)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setDiscountOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Cerrar descuento"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(["none", "percent", "amount"] as DiscountMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDiscountMode(mode)}
                  className={`h-8 rounded-lg px-2 text-xs font-bold ${discountMode === mode ? "bg-white text-blue-600 shadow-sm dark:bg-slate-950" : "text-slate-500"}`}
                >
                  {mode === "none" ? "0" : mode === "percent" ? "%" : "S/"}
                </button>
              ))}
            </div>
            <input
              disabled={discountMode === "none"}
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              placeholder="0.00"
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900"
            />
          </div>
        </div>
      ) : null}

      <Totals subtotal={subtotal} discountAmount={discountAmount} igvAmount={igvAmount} total={total} showTaxBreakdown={showTaxBreakdown} />
      <Button className="h-10 shrink-0 rounded-[24px] text-xs font-bold" disabled={cart.length === 0} onClick={onContinue}>
        Continuar
      </Button>
    </div>
  )
}

function PaymentStep({
  selectedComprobante,
  methods,
  selectedMethod,
  selectedMethodId,
  setSelectedMethodId,
  selectedAccountId,
  setSelectedAccountId,
  operationCode,
  setOperationCode,
  paymentDate,
  setPaymentDate,
  paymentTime,
  setPaymentTime,
  total,
  submitting,
  onBack,
  onSubmit,
}: {
  selectedComprobante: ComprobanteResumen | null
  methods: MetodoPago[]
  selectedMethod: MetodoPago | null
  selectedMethodId: number | null
  setSelectedMethodId: (value: number) => void
  selectedAccountId: number | null
  setSelectedAccountId: (value: number) => void
  operationCode: string
  setOperationCode: (value: string) => void
  paymentDate: string
  setPaymentDate: (value: string) => void
  paymentTime: string
  setPaymentTime: (value: string) => void
  total: number
  submitting: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pago</p>
          <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{selectedComprobante ? `${selectedComprobante.tipoComprobante} ${selectedComprobante.serie}` : "Sin comprobante"}</p>
        </div>
      </div>

      {selectedMethod && selectedMethod.cuentas.length > 1 ? (
        <select
          value={selectedAccountId ?? ""}
          onChange={(event) => setSelectedAccountId(Number(event.target.value))}
          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[11px] dark:border-slate-700 dark:bg-slate-950"
        >
          {selectedMethod.cuentas.map((account) => (
            <option key={account.idMetodoPagoCuenta} value={account.idMetodoPagoCuenta}>{account.numeroCuenta}</option>
          ))}
        </select>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5">
        {methods.map((method) => {
          const asset = paymentIcon(method.nombre)
          const selected = method.idMetodoPago === selectedMethodId
          return (
            <button
              key={method.idMetodoPago}
              type="button"
              onClick={() => setSelectedMethodId(method.idMetodoPago)}
              className={`min-w-0 rounded-2xl border p-1.5 text-center transition ${selected ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"}`}
            >
              <span className="flex min-w-0 flex-col items-center gap-1">
                <span className="relative flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  {asset.src ? <Image src={asset.src} alt={method.nombre} width={20} height={20} className="object-contain" /> : asset.icon}
                </span>
                <span className="max-w-full truncate text-[10px] font-bold leading-tight">{method.nombre}</span>
              </span>
              {method.cuentas?.length ? (
                <span className="mt-1 block space-y-1">
                  {method.cuentas.slice(0, 1).map((cuenta) => (
                    <span key={cuenta.idMetodoPagoCuenta} className="flex min-w-0 items-center justify-between gap-1 rounded-lg bg-slate-100 px-1.5 py-1 font-mono text-[9px] dark:bg-slate-800">
                      <span className="truncate">{cuenta.numeroCuenta}</span>
                      <Copy className="h-3 w-3 shrink-0" onClick={(event) => {
                        event.stopPropagation()
                        void navigator.clipboard.writeText(cuenta.numeroCuenta)
                        toast.success("Cuenta copiada")
                      }} />
                    </span>
                  ))}
                  {method.cuentas.length > 1 ? <span className="block truncate text-[9px] font-semibold text-slate-400">+{method.cuentas.length - 1}</span> : null}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {selectedMethod?.requiereCodigoOperacion || selectedMethod?.requiereFechaPago || selectedMethod?.requiereHoraPago ? (
        <div className="grid grid-cols-2 gap-2">
          {selectedMethod?.requiereCodigoOperacion ? (
            <input
              value={operationCode}
              onChange={(event) => setOperationCode(event.target.value)}
              placeholder="Codigo de operacion"
              className="col-span-2 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
            />
          ) : null}
          {selectedMethod?.requiereFechaPago ? (
            <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="h-9 min-w-0 rounded-xl border border-slate-200 px-2 text-[11px] dark:border-slate-700 dark:bg-slate-950" />
          ) : null}
          {selectedMethod?.requiereHoraPago ? (
            <input type="time" value={paymentTime} onChange={(event) => setPaymentTime(event.target.value)} className="h-9 min-w-0 rounded-xl border border-slate-200 px-2 text-[11px] dark:border-slate-700 dark:bg-slate-950" />
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
        <div className="flex items-end justify-between">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total a pagar</span>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{money(total)}</span>
        </div>
      </div>
      <Button className="h-11 rounded-[24px] text-xs font-bold" disabled={submitting} onClick={onSubmit}>
        {submitting ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Registrando...</> : <><CheckCircleIcon className="h-4 w-4" /> Confirmar venta</>}
      </Button>
    </div>
  )
}

function ProductDrawer({
  query,
  setQuery,
  page,
  setPage,
  onlyOffers,
  setOnlyOffers,
  catalog,
  loading,
  cart,
  selectedSucursalId,
  onAdd,
  onClose,
}: {
  query: string
  setQuery: (value: string) => void
  page: number
  setPage: (value: number | ((current: number) => number)) => void
  onlyOffers: boolean
  setOnlyOffers: (value: boolean) => void
  catalog: CatalogResponse | null
  loading: boolean
  cart: CartItem[]
  selectedSucursalId: number | null
  onAdd: (item: ProductoResumen) => void
  onClose: () => void
}) {
  const products = (catalog?.content ?? []).filter(isProductoResumen)

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white shadow-2xl animate-in slide-in-from-bottom duration-300 dark:bg-slate-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-3 dark:border-slate-700/60">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Carrito
        </button>

        <div className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto, SKU o color..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" title="Ofertas" aria-label="Filtrar ofertas" onClick={() => setOnlyOffers(!onlyOffers)} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-[11px] font-bold ${onlyOffers ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>
            <TagIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {!selectedSucursalId ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-slate-400">Selecciona sucursal.</div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-400">
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            Cargando productos...
          </div>
        ) : products.length ? (
          <div className="grid grid-cols-2 gap-2">
            {products.map((product) => {
              const imageUrl = getProductImage(product)
              const stock = getProductStock(product)
              const colores = Array.isArray(product.colores) ? product.colores : []
              const variantIds = new Set(
                colores.flatMap((color) =>
                  (Array.isArray(color.tallas) ? color.tallas : [])
                    .map((talla) => talla.idProductoVariante)
                    .filter((id): id is number => typeof id === "number" && id > 0),
                ),
              )
              const inCartQty = cart
                .filter((cartItem) => variantIds.has(cartItem.idProductoVariante))
                .reduce((sum, cartItem) => sum + cartItem.cantidad, 0)
              const colorCount = colores.length
              const tallaCount = new Set(colores.flatMap((color) => (Array.isArray(color.tallas) ? color.tallas : []).map((talla) => talla.tallaId))).size
              return (
                <button
                  key={product.idProducto}
                  type="button"
                  onClick={() => onAdd(product)}
                  className="overflow-hidden rounded-xl border border-slate-100 bg-white text-left shadow-sm transition hover:border-blue-200 dark:border-slate-700 dark:bg-slate-950"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                    {inCartQty > 0 ? <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{inCartQty}</span> : null}
                    {imageUrl ? <Image src={imageUrl} alt={product.nombre || "Producto"} fill unoptimized sizes="160px" className="object-cover" /> : <PhotoIcon className="m-auto h-full w-8 text-slate-400" />}
                    {stock <= 0 ? <div className="absolute inset-x-0 bottom-0 bg-rose-600/90 py-0.5 text-center text-[10px] font-bold text-white">Agotado</div> : null}
                  </div>
                  <div className="space-y-1.5 p-2">
                    <p className="line-clamp-2 min-h-8 text-[11px] font-bold text-slate-900 dark:text-slate-100">{product.nombre || "Producto"}</p>
                    <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">{product.nombreCategoria || "Sin categoria"}</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800">{colorCount} color(es)</span>
                      <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800">{tallaCount} talla(s)</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[9px] text-slate-400">Stock {stock}</span>
                      <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400">{getPriceRange(product)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs text-slate-400">Sin productos.</div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-700/60">
        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
          <Button variant="outline" className="h-8 text-xs" disabled={page <= 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            Ant.
          </Button>
          <span>Pagina {page + 1} de {Math.max(1, catalog?.totalPages ?? 1)}</span>
          <Button variant="outline" className="h-8 text-xs" disabled={Boolean(catalog?.last) || loading} onClick={() => setPage((value) => value + 1)}>
            Sig.
          </Button>
        </div>
        <Button className="h-10 w-full rounded-[22px] text-xs font-bold" onClick={onClose}>
          <ArrowLeftIcon className="h-4 w-4" />
          Regresar al carrito{cart.length > 0 ? ` (${cart.reduce((sum, item) => sum + item.cantidad, 0)})` : ""}
        </Button>
      </div>
    </div>
  )
}

function ProductSelectionModal({
  conversationId,
  product,
  selectedSucursalId,
  onClose,
  onConfirm,
}: {
  conversationId: string
  product: ProductoResumen | null
  selectedSucursalId: number | null
  onClose: () => void
  onConfirm: (variant: SelectedProductVariant) => void
}) {
  const [detail, setDetail] = useState<ProductoDetalleResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null)
  const [selectedTallaId, setSelectedTallaId] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [priceType, setPriceType] = useState<PriceType>("normal")
  const [isMobileDrawer, setIsMobileDrawer] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)")
    const update = () => setIsMobileDrawer(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (!product) {
      const timeoutId = window.setTimeout(() => {
        setDetail(null)
        setError(null)
        setSelectedColorId(null)
        setSelectedTallaId(null)
        setCantidad(1)
        setPriceType("normal")
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
    const controller = new AbortController()
    const initTimeoutId = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      setDetail(null)
      setCantidad(1)
      setPriceType("normal")
    }, 0)
    authFetch(`/api/crm/whatsapp/conversations/${conversationId}/sale-products/${product.idProducto}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, "No se pudo cargar el producto"))
        return response.json() as Promise<ProductoDetalleResponse>
      })
      .then((data) => {
        if (controller.signal.aborted) return
        setDetail(data)
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
        setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el producto")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      window.clearTimeout(initTimeoutId)
      controller.abort()
    }
  }, [conversationId, product])

  const colorOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; hex: string }>()
    product?.colores.forEach((color) => {
      map.set(color.colorId, { id: color.colorId, name: color.nombre || `Color #${color.colorId}`, hex: normalizeHexColor(color.hex) })
    })
    detail?.variantes.forEach((variant) => {
      map.set(variant.colorId, { id: variant.colorId, name: variant.colorNombre || `Color #${variant.colorId}`, hex: normalizeHexColor(variant.colorHex) })
    })
    detail?.imagenes.forEach((image) => {
      if (!image.colorId) return
      const previous = map.get(image.colorId)
      map.set(image.colorId, {
        id: image.colorId,
        name: previous?.name || image.colorNombre || `Color #${image.colorId}`,
        hex: previous?.hex || normalizeHexColor(image.colorHex),
      })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [detail, product])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
    if (!product || colorOptions.length === 0) {
      setSelectedColorId(null)
      return
    }
    setSelectedColorId((current) => (current && colorOptions.some((color) => color.id === current) ? current : colorOptions[0].id))
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [colorOptions, product])

  const variantsForColor = useMemo(() => {
    if (!detail || selectedColorId === null) return []
    return detail.variantes
      .filter((variant) => variant.colorId === selectedColorId)
      .sort((a, b) => a.tallaNombre.localeCompare(b.tallaNombre))
  }, [detail, selectedColorId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
    if (variantsForColor.length === 0) {
      setSelectedTallaId(null)
      return
    }
    setSelectedTallaId((current) => {
      if (current && variantsForColor.some((variant) => variant.tallaId === current)) return current
      const available = variantsForColor.find((variant) => isActive(variant.estado) && getVariantStock(variant, selectedSucursalId) > 0)
      return available?.tallaId ?? variantsForColor[0].tallaId
    })
    setCantidad(1)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [selectedSucursalId, variantsForColor])

  const selectedVariant = useMemo(
    () => variantsForColor.find((variant) => variant.tallaId === selectedTallaId) ?? null,
    [selectedTallaId, variantsForColor],
  )
  const prices = useMemo(() => (selectedVariant ? buildVariantPrices(selectedVariant) : []), [selectedVariant])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
    const nextDefault = defaultPrice(prices)?.type ?? "normal"
    setPriceType((current) => (prices.some((price) => price.type === current) ? current : nextDefault))
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [prices])

  const selectedPrice = prices.find((price) => price.type === priceType) ?? prices[0] ?? null
  const stock = selectedVariant ? getVariantStock(selectedVariant, selectedSucursalId) : 0
  const canConfirm = Boolean(selectedVariant && isActive(selectedVariant.estado) && stock > 0 && selectedPrice)
  const selectedColor = colorOptions.find((color) => color.id === selectedColorId) ?? null
  const colorStock = variantsForColor.reduce((sum, variant) => sum + getVariantStock(variant, selectedSucursalId), 0)
  const priceDescription =
    selectedPrice?.type === "oferta"
      ? "Precio oferta"
      : selectedPrice?.type === "mayor"
        ? "Precio por mayor"
        : "Precio regular"

  const galleryImages = useMemo(() => {
    if (!product) return []
    const urls = [
      ...(detail?.imagenes || [])
        .filter((image) => image.colorId === selectedColorId)
        .sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || Number(a.orden || 0) - Number(b.orden || 0))
        .flatMap((image) => [image.url, image.urlThumb]),
      product.colores.find((color) => color.colorId === selectedColorId)?.imagenPrincipal?.url,
      product.colores.find((color) => color.colorId === selectedColorId)?.imagenPrincipal?.urlThumb,
      product.imagenGlobalUrl,
      product.imagenGlobalThumbUrl,
    ].filter((url): url is string => Boolean(url))
    return Array.from(new Set(urls))
  }, [detail, product, selectedColorId])

  if (!product) return null

  const selectorContent = (
    <>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm backdrop-blur hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200" aria-label="Cerrar">
          <XMarkIcon className="h-4 w-4" />
        </button>
        <div className="grid h-full min-w-0 grid-rows-[42%_minmax(0,1fr)] overflow-hidden sm:grid-cols-[52%_minmax(430px,1fr)] sm:grid-rows-1">
          <div className="relative min-h-0 bg-slate-100 dark:bg-slate-800">
            {galleryImages[0] ? (
              <Image src={galleryImages[0]} alt={product.nombre} fill unoptimized sizes="520px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <PhotoIcon className="h-12 w-12 text-slate-400" />
              </div>
            )}
            {galleryImages.length > 1 ? (
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {galleryImages.slice(0, 14).map((url, index) => (
                  <span key={`${url}-${index}`} className={`h-1.5 rounded-full ${index === 0 ? "w-4 bg-white" : "w-1.5 bg-white/65"}`} />
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-5 sm:px-5">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">{product.nombreCategoria || "Producto"}</span>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-300">{product.estado || "ACTIVO"}</span>
              </div>
              <h3 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900 dark:text-slate-100">{product.nombre}</h3>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                SKU: <span className="text-blue-500">{selectedVariant?.sku || product.sku || "SIN SKU"}</span>
              </p>
              <p className="mt-1 text-2xl font-extrabold text-blue-600 dark:text-blue-400">{money(selectedPrice?.value || 0)}</p>
              <p className="text-[11px] font-medium text-slate-400">{priceDescription}</p>
            {loading ? (
              <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Cargando detalle...
              </div>
            ) : error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
            ) : (
              <div className="mt-5 space-y-5">
                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Color: <span className="uppercase">{selectedColor?.name || "-"}</span>
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400">Stock color: {colorStock}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pb-2">
                    {colorOptions.map((color) => (
                      <button key={color.id} type="button" onClick={() => setSelectedColorId(color.id)} className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full" title={color.name} aria-label={color.name}>
                        <span className={`h-8 w-8 rounded-full border shadow-sm transition ${selectedColorId === color.id ? "border-blue-500 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900" : "border-white/80 dark:border-slate-700"}`} style={{ backgroundColor: color.hex }} />
                        <span className="pointer-events-none absolute -top-7 left-1/2 z-20 max-w-24 -translate-x-1/2 truncate rounded bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100">
                          {color.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {variantsForColor.map((variant) => {
                      const variantStock = getVariantStock(variant, selectedSucursalId)
                      const disabled = !isActive(variant.estado) || variantStock <= 0
                      return (
                        <button key={variant.idProductoVariante} type="button" disabled={disabled} onClick={() => setSelectedTallaId(variant.tallaId)} className={`min-h-12 rounded-xl border px-2 py-2 text-center text-xs font-bold shadow-sm transition disabled:opacity-40 ${selectedTallaId === variant.tallaId ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"}`}>
                          <span className="block truncate">{variant.tallaNombre}</span>
                          <span className="mt-1 block text-[9px] font-semibold text-slate-400">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> {variantStock} Disp.
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
                {prices.length > 1 ? (
                  <section>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Precio</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {prices.map((price) => (
                      <button key={price.type} type="button" onClick={() => setPriceType(price.type)} className={`rounded-xl border px-2 py-2 text-center text-[10px] font-bold ${priceType === price.type ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10" : "border-slate-200 dark:border-slate-700"}`}>
                        <span className="block truncate">{price.label}</span>
                        <span className="block text-xs">{money(price.value)}</span>
                      </button>
                    ))}
                  </div>
                </section>
                ) : null}
              </div>
            )}
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-4">
              <p className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">Cantidad</p>
              <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
                <div className="flex h-10 min-w-0 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-2 dark:border-slate-700 dark:bg-slate-950">
                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white dark:hover:bg-slate-800" onClick={() => setCantidad((value) => Math.max(1, value - 1))}>
                    <MinusIcon className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-sm font-extrabold">{cantidad}</span>
                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white dark:hover:bg-slate-800" onClick={() => setCantidad((value) => Math.min(stock, value + 1))}>
                    <PlusIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Button
                  type="button"
                  className="h-10 min-w-0 rounded-[18px] bg-blue-600 px-2 text-[11px] font-bold hover:bg-blue-700 sm:text-xs"
                  disabled={!canConfirm}
                  onClick={() => {
                    if (!selectedVariant || !selectedPrice) return
                    onConfirm({
                      idProductoVariante: selectedVariant.idProductoVariante,
                      nombre: detail?.producto.nombre || product.nombre,
                      sku: selectedVariant.sku,
                      color: selectedColor?.name || selectedVariant.colorNombre,
                      talla: selectedVariant.tallaNombre,
                      imageUrl: galleryImages[0] || null,
                      stock,
                      cantidad,
                      priceType: selectedPrice.type,
                      precio: selectedPrice.value,
                      prices,
                    })
                  }}
                >
                  <ShoppingBagIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">Agregar al pedido - {money((selectedPrice?.value || 0) * cantidad)}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
    </>
  )

  if (isMobileDrawer) {
    return (
      <Sheet open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[94dvh] overflow-hidden rounded-t-3xl border-0 bg-white p-0 shadow-2xl dark:bg-slate-900">
          <SheetHeader className="sr-only">
            <SheetTitle>{product.nombre}</SheetTitle>
          </SheetHeader>
          {selectorContent}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[84dvh] !w-[min(1080px,calc(100vw-3rem))] !max-w-none overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl dark:bg-slate-900" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{product.nombre}</DialogTitle>
          <DialogDescription>Selecciona color, talla y cantidad.</DialogDescription>
        </DialogHeader>
        {selectorContent}
      </DialogContent>
    </Dialog>
  )
}

function Totals({ subtotal, discountAmount, igvAmount, total, showTaxBreakdown }: { subtotal: number; discountAmount: number; igvAmount: number; total: number; showTaxBreakdown: boolean }) {
  return (
    <div className="shrink-0 space-y-1 rounded-2xl border border-slate-100 bg-white p-2.5 text-xs text-slate-500 dark:border-slate-700/60 dark:bg-slate-950/30">
      {showTaxBreakdown ? (
        <>
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>IGV incluido</span><span>{money(igvAmount)}</span></div>
        </>
      ) : null}
      {discountAmount > 0 ? <div className="flex justify-between text-emerald-600"><span>Descuento</span><span>-{money(discountAmount)}</span></div> : null}
      <div className="flex items-end justify-between pt-1 text-slate-900 dark:text-slate-100">
        <span className="text-sm font-bold">Total</span>
        <span className="text-[26px] font-extrabold leading-none">{money(total)}</span>
      </div>
    </div>
  )
}
