"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authFetch } from "@/lib/auth/auth-fetch"
import { AiKnowledgeBasePanel } from "@/components/crm/AiKnowledgeBasePanel"

type WhatsappStatusValue = "INITIALIZING" | "QR_REQUIRED" | "CONNECTED" | "DISCONNECTED" | "AUTH_FAILURE"

interface WhatsappStatus {
  clientId: string
  status: WhatsappStatusValue
  connectedNumber: string | null
  hasQr: boolean
  lastActivityAt: string | null
  lastError: string | null
  connectionConfigured: boolean
  branch: WhatsappBranch | null
  previousConnectedNumber: string | null
  phoneChanged: boolean
  changeAcknowledged: boolean
  operationsBlocked: boolean
  blockedReason: string
  disconnectedAt: string | null
  phoneChangedAt: string | null
}

interface WhatsappBranch {
  idSucursal: number
  nombreSucursal: string
  tipoSucursal: string
}

interface WhatsappQrResponse extends WhatsappStatus {
  qr?: string
  qrDataUrl?: string
}

type AiMode = "DESACTIVADA" | "SUGERENCIAS" | "AUTOMATICA"
type AiTone = "CERCANO" | "FORMAL" | "COMERCIAL" | "PERSONALIZADO"
interface AiConfig {
  connectionConfigured: boolean
  branch: WhatsappBranch | null
  modo: AiMode
  zonaHoraria: string
  diasAtencion: string[]
  horaInicio: string
  horaFin: string
  esperaRespuestaSegundos: number
  tono: AiTone
  instruccionesPersonalizadas: string
  intencionesPermitidas: string[]
  maxRespuestasAutomaticas: number
  confianzaMinima: number
  transferirBajaConfianza: boolean
  transferirSolicitudHumana: boolean
  transferirAsuntoSensible: boolean
  transferirImagenesAsesora: boolean
  mostrarProductosNuevos: boolean
  mandarCatalogoImagenes: boolean
  sugerirPromocionesCarrito: boolean
  dailyTokenLimit: number | null
  monthlyTokenLimit: number | null
  monthlyBudgetUsd: number | null
  inputCostPerMillionUsd: number | null
  outputCostPerMillionUsd: number | null
  automaticRolloutPercent: number
  naturalResponseEnabled: boolean
  naturalResponseRolloutPercent: number
  operational: AiOperationalStatus
  horariosComerciales: BusinessHours[]
  reglasSeguridad: string[]
}

function normalizeAiConfig(config: AiConfig): AiConfig {
  const naturalRollout = Number(config.naturalResponseRolloutPercent)
  return {
    ...config,
    transferirImagenesAsesora: config.transferirImagenesAsesora ?? false,
    mostrarProductosNuevos: config.mostrarProductosNuevos ?? false,
    mandarCatalogoImagenes: config.mandarCatalogoImagenes ?? false,
    sugerirPromocionesCarrito: config.sugerirPromocionesCarrito ?? false,
    naturalResponseEnabled: config.naturalResponseEnabled ?? false,
    naturalResponseRolloutPercent: Number.isInteger(naturalRollout)
      && naturalRollout >= 0
      && naturalRollout <= 100
      ? naturalRollout
      : 0,
  }
}

interface AiOperationalStatus {
  status: "ACTIVE" | "LIMITED" | "EMERGENCY_STOP"
  limited: boolean
  dailyTokens: number
  monthlyTokens: number
  monthlyCostUsd: number
  dailyTokenLimit: number | null
  monthlyTokenLimit: number | null
  monthlyBudgetUsd: number | null
  rolloutPercent: number
  reason: string | null
}

interface BusinessHours {
  dia: string
  cerrado: boolean
  horaApertura: string
  horaCierre: string
}

interface AiCredentials {
  configured: boolean
  source: "DATABASE" | "ENVIRONMENT" | "NONE"
  maskedKey: string
  model: string
  updatedAt: string | null
  updatedBy: string | null
  masterKeyConfigured: boolean
}

const AI_DAYS = [
  ["LUNES", "Lun"], ["MARTES", "Mar"], ["MIERCOLES", "Mie"], ["JUEVES", "Jue"],
  ["VIERNES", "Vie"], ["SABADO", "Sab"], ["DOMINGO", "Dom"],
] as const

const AI_INTENTS = [
  ["SALUDO", "Saludo"], ["PRODUCTOS", "Productos"], ["ENLACE_ECOMMERCE", "Enlaces del ecommerce"], ["PRECIO", "Precio"], ["STOCK", "Stock"],
  ["COLORES_TALLAS", "Colores y tallas"], ["GUIA_TALLAS", "Guía de tallas"], ["OFERTAS", "Ofertas"], ["PROMOCIONES", "Promociones y combos"],
  ["UBICACION", "Ubicacion"], ["HORARIOS", "Horarios"], ["METODOS_PAGO", "Metodos de pago"],
  ["ENVIOS", "Envios"], ["TIENDAS", "Tiendas"], ["POLITICAS", "Politicas"],
  ["CUIDADOS", "Cuidados"], ["FAQ", "Preguntas frecuentes"], ["INSTITUCIONAL", "Institucional"],
  ["INFORMACION_NEGOCIO", "Informacion general"],
  ["MI_CUENTA", "Mi cuenta"], ["HISTORIAL_VENTAS", "Historial de ventas"],
  ["INTENCION_COMPRA", "Preparar pedidos"], ["MODIFICAR_CARRITO", "Modificar carrito"],
  ["CONFIRMAR_PEDIDO", "Confirmar pedido"], ["CANCELAR_PEDIDO", "Cancelar pedido"],
  ["ESTADO_VENTA", "Estado de venta"],
] as const

const GEMINI_MODELS = [
  ["gemini-3.8-flash", "Gemini 3.8 Flash - Recomendado"],
  ["gemini-3.7-flash", "Gemini 3.7 Flash"],
  ["gemini-3.6-flash", "Gemini 3.6 Flash"],
  ["gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite - Economico"],
  ["gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"],
  ["gemini-2.5-flash", "Gemini 2.5 Flash - Compatibilidad"],
  ["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite - Compatibilidad"],
  ["gemini-2.5-pro", "Gemini 2.5 Pro - Compatibilidad"],
] as const

const MIN_AI_RESPONSE_DELAY_SECONDS = 3
const MAX_AI_RESPONSE_DELAY_SECONDS = 60
const MIN_AI_AUTOMATIC_RESPONSES = 1
const MAX_AI_AUTOMATIC_RESPONSES = 50

const statusMap: Record<WhatsappStatusValue, { label: string; description: string; className: string }> = {
  INITIALIZING: {
    label: "Inicializando",
    description: "Preparando la sesion de WhatsApp Web.",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  QR_REQUIRED: {
    label: "QR requerido",
    description: "Escanea el codigo con el WhatsApp principal de KIMETS.",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  CONNECTED: {
    label: "Conectado",
    description: "WhatsApp esta listo para recibir mensajes.",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  DISCONNECTED: {
    label: "Desconectado",
    description: "La sesion de WhatsApp no esta activa.",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  AUTH_FAILURE: {
    label: "Error de autenticacion",
    description: "WhatsApp rechazo la sesion. Cierra sesion y escanea nuevamente.",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
}

function formatDate(value: string | null) {
  if (!value) return "Sin actividad"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin actividad"

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

async function readMessage(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data.message === "string" ? data.message : fallback
  } catch {
    return fallback
  }
}

export default function ConexionesPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<WhatsappStatus | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isAcknowledgingPhoneChange, setIsAcknowledgingPhoneChange] = useState(false)
  const [branches, setBranches] = useState<WhatsappBranch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [isSavingBranch, setIsSavingBranch] = useState(false)
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"WHATSAPP" | "IA">(
    searchParams.get("tab")?.toLowerCase() === "ia" ? "IA" : "WHATSAPP",
  )
  const [isIntentionsOpen, setIsIntentionsOpen] = useState(false)
  const [isProductionControlOpen, setIsProductionControlOpen] = useState(false)
  const [aiExpanded, setAiExpanded] = useState(false)
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null)
  const [isLoadingAi, setIsLoadingAi] = useState(false)
  const [isSavingAi, setIsSavingAi] = useState(false)
  const [aiCredentials, setAiCredentials] = useState<AiCredentials | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [modelInput, setModelInput] = useState("gemini-3.8-flash")
  const [isSavingCredentials, setIsSavingCredentials] = useState(false)
  const [isTestingCredentials, setIsTestingCredentials] = useState(false)
  const [isDeletingCredentials, setIsDeletingCredentials] = useState(false)
  const [controlReason, setControlReason] = useState("")
  const [isChangingAiControl, setIsChangingAiControl] = useState(false)

  const loadConnection = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const statusRes = await authFetch("/api/crm/whatsapp/status", { cache: "no-store" })

      if (!statusRes.ok) {
        throw new Error(await readMessage(statusRes, "Microservicio de WhatsApp no disponible"))
      }

      const nextStatus = (await statusRes.json()) as WhatsappStatus
      setStatus(nextStatus)
      setSelectedBranchId((current) => current || (nextStatus.branch ? String(nextStatus.branch.idSucursal) : ""))
      setError(null)

      if (nextStatus.connectionConfigured && nextStatus.status === "QR_REQUIRED" && nextStatus.hasQr) {
        const qrRes = await authFetch("/api/crm/whatsapp/qr", { cache: "no-store" })

        if (qrRes.ok) {
          const qrPayload = (await qrRes.json()) as WhatsappQrResponse
          setQrDataUrl(qrPayload.qrDataUrl || null)
        } else {
          setQrDataUrl(null)
        }
      } else {
        setQrDataUrl(null)
      }

    } catch (err) {
      setStatus(null)
      setQrDataUrl(null)
      setError(err instanceof Error ? err.message : "Microservicio de WhatsApp no disponible")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const loadBranches = useCallback(async () => {
    setIsLoadingBranches(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/branches", { cache: "no-store" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudieron cargar las sucursales"))
      setBranches((await response.json()) as WhatsappBranch[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las sucursales")
    } finally {
      setIsLoadingBranches(false)
    }
  }, [])

  const loadAiConfig = useCallback(async () => {
    setIsLoadingAi(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-config", { cache: "no-store" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo cargar la configuracion de IA Kiments"))
      setAiConfig(normalizeAiConfig((await response.json()) as AiConfig))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la configuracion de IA Kiments")
    } finally {
      setIsLoadingAi(false)
    }
  }, [])

  const loadAiCredentials = useCallback(async () => {
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-credentials", { cache: "no-store" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo cargar el proveedor de IA Kiments"))
      const credentials = (await response.json()) as AiCredentials
      setAiCredentials(credentials)
      setModelInput(credentials.model || "gemini-3.8-flash")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el proveedor de IA Kiments")
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadConnection()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadConnection])

  useEffect(() => {
    if (!isWhatsappModalOpen) return

    const timeoutId = window.setTimeout(() => {
      void loadConnection()
      void loadBranches()
    }, 0)
    const intervalId = window.setInterval(() => {
      void loadConnection()
    }, 4000)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [isWhatsappModalOpen, loadBranches, loadConnection])

  useEffect(() => {
    if (activeTab !== "IA") return

    const timeoutId = window.setTimeout(() => {
      void loadAiConfig()
      void loadAiCredentials()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [activeTab, loadAiConfig, loadAiCredentials])

  const handleSaveBranch = async () => {
    const idSucursal = Number(selectedBranchId)
    if (!Number.isFinite(idSucursal) || idSucursal <= 0) {
      toast.error("Selecciona una sucursal de venta")
      return
    }
    const isChanging = status?.branch && status.branch.idSucursal !== idSucursal
    if (isChanging && status?.status === "CONNECTED"
      && !window.confirm("La nueva sucursal se usara para el stock y las ventas futuras de WhatsApp. Continuar?")) {
      return
    }
    setIsSavingBranch(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/branch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idSucursal }),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo vincular la sucursal"))
      toast.success(isChanging ? "Sucursal de WhatsApp actualizada" : "Sucursal vinculada con WhatsApp")
      await loadConnection()
      await loadAiConfig()
      await loadAiCredentials()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo vincular la sucursal")
    } finally {
      setIsSavingBranch(false)
    }
  }

  const handleSaveCredentials = async () => {
    const apiKey = apiKeyInput.trim()
    if (apiKey && apiKey.length < 20) {
      toast.error("Ingresa una API key de Gemini valida")
      return
    }
    if (!apiKey && !aiCredentials?.configured) {
      toast.error("Ingresa una API key de Gemini")
      return
    }
    if (!modelInput.trim()) {
      toast.error("Ingresa el modelo de Gemini")
      return
    }
    setIsSavingCredentials(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model: modelInput.trim() }),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo guardar la API key"))
      const credentials = (await response.json()) as AiCredentials
      setAiCredentials(credentials)
      setModelInput(credentials.model)
      setApiKeyInput("")
      toast.success(apiKey ? "Credencial y modelo de Gemini guardados" : "Modelo de Gemini actualizado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la API key")
    } finally {
      setIsSavingCredentials(false)
    }
  }

  const handleTestCredentials = async () => {
    setIsTestingCredentials(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-credentials/test", { method: "POST" })
      if (!response.ok) throw new Error(await readMessage(response, "Gemini rechazo la credencial"))
      const result = (await response.json()) as { model: string; latencyMs: number }
      toast.success(`Conexion correcta con ${result.model} (${result.latencyMs} ms)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo validar Gemini")
    } finally {
      setIsTestingCredentials(false)
    }
  }

  const handleDeleteCredentials = async () => {
    if (!window.confirm("Eliminar la API key guardada en el CRM? IA Kiments quedara deshabilitada si no existe una clave del servidor.")) return
    setIsDeletingCredentials(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-credentials", { method: "DELETE" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo eliminar la API key"))
      const credentials = (await response.json()) as AiCredentials
      setAiCredentials(credentials)
      setModelInput(credentials.model)
      setApiKeyInput("")
      toast.success("API key eliminada")
      await loadAiConfig()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la API key")
    } finally {
      setIsDeletingCredentials(false)
    }
  }

  const toggleAiListValue = (field: "diasAtencion" | "intencionesPermitidas", value: string) => {
    setAiConfig((current) => {
      if (!current) return current
      const values = current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value]
      return { ...current, [field]: values }
    })
  }

  const toggleNaturalResponse = (enabled: boolean) => {
    setAiConfig((current) => current ? {
      ...current,
      naturalResponseEnabled: enabled,
      naturalResponseRolloutPercent: enabled && (!Number.isFinite(current.naturalResponseRolloutPercent)
        || current.naturalResponseRolloutPercent <= 0)
        ? 100
        : current.naturalResponseRolloutPercent,
    } : current)
  }

  const handleSaveAi = async () => {
    if (!aiConfig) return
    if (!aiConfig.connectionConfigured) {
      toast.error("Vincula primero una sucursal de venta")
      return
    }
    if (aiConfig.tono === "PERSONALIZADO" && aiConfig.instruccionesPersonalizadas.trim().length < 10) {
      toast.error("Describe el tono personalizado con al menos 10 caracteres")
      return
    }
    const responseDelaySeconds = Number(aiConfig.esperaRespuestaSegundos)
    if (!Number.isInteger(responseDelaySeconds)
      || responseDelaySeconds < MIN_AI_RESPONSE_DELAY_SECONDS
      || responseDelaySeconds > MAX_AI_RESPONSE_DELAY_SECONDS) {
      toast.error(`La espera debe estar entre ${MIN_AI_RESPONSE_DELAY_SECONDS} y ${MAX_AI_RESPONSE_DELAY_SECONDS} segundos`)
      return
    }
    const maxAutomaticResponses = Number(aiConfig.maxRespuestasAutomaticas)
    if (!Number.isInteger(maxAutomaticResponses)
      || maxAutomaticResponses < MIN_AI_AUTOMATIC_RESPONSES
      || maxAutomaticResponses > MAX_AI_AUTOMATIC_RESPONSES) {
      toast.error(`El maximo debe estar entre ${MIN_AI_AUTOMATIC_RESPONSES} y ${MAX_AI_AUTOMATIC_RESPONSES} respuestas`)
      return
    }
    const naturalResponseRolloutPercent = Number(aiConfig.naturalResponseRolloutPercent)
    if (!Number.isInteger(naturalResponseRolloutPercent)
      || naturalResponseRolloutPercent < 0
      || naturalResponseRolloutPercent > 100) {
      toast.error("El despliegue de redaccion natural debe estar entre 0% y 100%")
      return
    }
    setIsSavingAi(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: aiConfig.modo,
          zonaHoraria: aiConfig.zonaHoraria,
          diasAtencion: aiConfig.diasAtencion,
          horaInicio: aiConfig.horaInicio,
          horaFin: aiConfig.horaFin,
          esperaRespuestaSegundos: responseDelaySeconds,
          tono: aiConfig.tono,
          instruccionesPersonalizadas: aiConfig.instruccionesPersonalizadas,
          intencionesPermitidas: aiConfig.intencionesPermitidas,
          maxRespuestasAutomaticas: maxAutomaticResponses,
          confianzaMinima: aiConfig.confianzaMinima,
          transferirBajaConfianza: aiConfig.transferirBajaConfianza,
          transferirImagenesAsesora: aiConfig.transferirImagenesAsesora,
          mostrarProductosNuevos: aiConfig.mostrarProductosNuevos,
          mandarCatalogoImagenes: aiConfig.mandarCatalogoImagenes,
          sugerirPromocionesCarrito: aiConfig.sugerirPromocionesCarrito,
          dailyTokenLimit: aiConfig.dailyTokenLimit,
          monthlyTokenLimit: aiConfig.monthlyTokenLimit,
          monthlyBudgetUsd: aiConfig.monthlyBudgetUsd,
          inputCostPerMillionUsd: aiConfig.inputCostPerMillionUsd,
          outputCostPerMillionUsd: aiConfig.outputCostPerMillionUsd,
          automaticRolloutPercent: aiConfig.automaticRolloutPercent,
          naturalResponseEnabled: aiConfig.naturalResponseEnabled,
          naturalResponseRolloutPercent,
        }),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo guardar la configuracion de IA Kiments"))
      setAiConfig(normalizeAiConfig((await response.json()) as AiConfig))
      toast.success("Configuracion de IA Kiments guardada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la configuracion de IA Kiments")
    } finally {
      setIsSavingAi(false)
    }
  }

  const handleAiControl = async (statusValue: "ACTIVE" | "EMERGENCY_STOP") => {
    if (controlReason.trim().length < 5) {
      toast.error("Ingresa un motivo de al menos 5 caracteres")
      return
    }
    const action = statusValue === "EMERGENCY_STOP" ? "detener inmediatamente" : "reactivar"
    if (!window.confirm(`¿Confirmas que deseas ${action} IA Kiments?`)) return
    setIsChangingAiControl(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue, reason: controlReason.trim() }),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo cambiar el control operativo"))
      setControlReason("")
      await loadAiConfig()
      toast.success(statusValue === "EMERGENCY_STOP" ? "IA Kiments detenida inmediatamente" : "IA Kiments reactivada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el control operativo")
    } finally {
      setIsChangingAiControl(false)
    }
  }

  const handleLogout = async () => {
    if (!window.confirm("Cerrar la sesion actual de WhatsApp?")) return

    setIsLoggingOut(true)

    try {
      const response = await authFetch("/api/crm/whatsapp/logout", { method: "POST" })

      if (!response.ok) {
        throw new Error(await readMessage(response, "No se pudo cerrar la sesion de WhatsApp"))
      }

      toast.success("Sesion de WhatsApp cerrada")
      await loadConnection()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cerrar la sesion de WhatsApp")
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleAcknowledgePhoneChange = async () => {
    if (!status?.phoneChanged) return
    if (!window.confirm(`Las respuestas futuras se enviaran desde ${status.connectedNumber}. Deseas confirmar este cambio?`)) return
    setIsAcknowledgingPhoneChange(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/acknowledge-phone-change", {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error(await readMessage(response, "No se pudo confirmar el nuevo numero"))
      }
      await loadConnection()
      toast.success("Nuevo numero de WhatsApp confirmado")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo confirmar el nuevo numero")
    } finally {
      setIsAcknowledgingPhoneChange(false)
    }
  }

  const openWhatsappModal = () => {
    setIsWhatsappModalOpen(true)
  }

  const currentStatus = status ? statusMap[status.status] : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Conexiones</h2>
        <p className="mt-1 text-sm text-muted-foreground">Administra los canales conectados al CRM.</p>
      </div>

      <div className="inline-flex w-full rounded-xl border border-border bg-muted/40 p-1 sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("WHATSAPP")}
          className={`flex-1 rounded-lg px-5 py-2 text-xs font-semibold transition sm:flex-none ${activeTab === "WHATSAPP" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("IA")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold transition sm:flex-none ${activeTab === "IA" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <SparklesIcon className="h-4 w-4" />
          IA Kiments
        </button>
      </div>

      {activeTab === "WHATSAPP" && <div className="grid gap-3">
        <article className="rounded-2xl border border-border bg-background p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Image src="/svg/whatsapp.svg" alt="WhatsApp" width={30} height={30} className="h-8 w-8" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">WhatsApp</h3>
                  {currentStatus && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${currentStatus.className}`}>
                      {status?.status === "CONNECTED" ? (
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      ) : (
                        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                      )}
                      {currentStatus.label}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status?.connectedNumber
                    ? `Numero conectado: ${status.connectedNumber}`
                    : "Conecta el WhatsApp principal para recibir y responder chats."}
                </p>
                {status?.branch && (
                  <p className="mt-1 text-xs font-medium text-foreground">
                    Sucursal: {status.branch.nombreSucursal}
                  </p>
                )}
                {error && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p>}
                {!error && status?.lastActivityAt && (
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    Ultima actividad: {formatDate(status.lastActivityAt)}
                  </p>
                )}
              </div>
            </div>

            <Button onClick={openWhatsappModal} className="rounded-xl">
              {status?.status === "CONNECTED" ? "Ver conexion" : "Conectar"}
            </Button>
          </div>
        </article>
        {status?.phoneChanged && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Se conecto un numero diferente</p>
                <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">
                  Anterior: <strong>{status.previousConnectedNumber || "No disponible"}</strong> · Nuevo: <strong>{status.connectedNumber || "No disponible"}</strong>. Los envios e IA Kiments estan pausados hasta confirmar.
                </p>
              </div>
              <Button type="button" onClick={() => void handleAcknowledgePhoneChange()} disabled={isAcknowledgingPhoneChange} className="shrink-0 rounded-xl bg-amber-600 text-white hover:bg-amber-700">
                {isAcknowledgingPhoneChange ? "Confirmando..." : "Usar nuevo numero"}
              </Button>
            </div>
          </div>
        )}
      </div>}

      {activeTab === "IA" && (
        <div className="space-y-4">
          {aiConfig && (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid w-full grid-cols-3 gap-1.5 rounded-xl border border-border bg-muted/70 p-1.5 shadow-sm sm:w-[30rem]">
                  {(["DESACTIVADA", "SUGERENCIAS", "AUTOMATICA"] as AiMode[]).map((mode) => <button key={mode} type="button" disabled={mode !== "DESACTIVADA" && (!aiConfig.connectionConfigured || !aiCredentials?.configured)} onClick={() => setAiConfig({ ...aiConfig, modo: mode })} className={`flex h-11 min-w-0 items-center justify-center rounded-lg border px-2 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-xs ${aiConfig.modo === mode ? "border-primary bg-primary text-primary-foreground shadow-md" : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5"}`}>{mode === "DESACTIVADA" ? "Desactivada" : mode === "SUGERENCIAS" ? "Sugerencias" : "Automatica"}</button>)}
                </div>
                <Button className="h-10 w-full rounded-xl sm:w-auto" onClick={() => void handleSaveAi()} disabled={isSavingAi || !aiConfig.connectionConfigured}>
                  <SparklesIcon className="h-4 w-4" />
                  {isSavingAi ? "Guardando..." : "Guardar configuracion"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                  <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Tokens hoy</span>
                  <strong className="mt-2 block text-2xl text-foreground">{aiConfig.operational.dailyTokens.toLocaleString("es-PE")}</strong>
                </article>
                <article className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                  <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Tokens del mes</span>
                  <strong className="mt-2 block text-2xl text-foreground">{aiConfig.operational.monthlyTokens.toLocaleString("es-PE")}</strong>
                </article>
                <article className="col-span-2 rounded-2xl border border-border bg-background p-4 shadow-sm sm:col-span-1">
                  <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Costo estimado</span>
                  <strong className="mt-2 block text-2xl text-foreground">US$ {Number(aiConfig.operational.monthlyCostUsd || 0).toFixed(4)}</strong>
                </article>
              </div>
            </div>
          )}

          {isLoadingAi || !aiConfig ? (
            <div className="flex min-h-56 items-center justify-center gap-2 rounded-2xl border border-border bg-background text-sm text-muted-foreground">
              <ArrowPathIcon className="h-5 w-5 animate-spin" /> Cargando configuracion de IA Kiments...
            </div>
          ) : (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <div className="space-y-4">
                <section className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><KeyIcon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold">Proveedor Gemini</h4>
                      <p className="text-xs text-muted-foreground">{aiCredentials?.configured ? `Credencial activa (${aiCredentials.source === "DATABASE" ? "guardada en CRM" : "servidor"})` : "Sin API key configurada"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${aiCredentials?.configured ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>{aiCredentials?.configured ? "Configurada" : "Pendiente"}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium">{aiCredentials?.source === "DATABASE" ? "Nueva API key" : "API key"}<input type="password" value={apiKeyInput} autoComplete="new-password" onChange={(event) => setApiKeyInput(event.target.value)} placeholder={aiCredentials?.configured ? aiCredentials.maskedKey : "AIza..."} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary" /></label>
                    <label className="space-y-1 text-xs font-medium">Modelo<select value={modelInput} onChange={(event) => setModelInput(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary">{modelInput && !GEMINI_MODELS.some(([value]) => value === modelInput) && <option value={modelInput}>{modelInput} - Configurado</option>}{GEMINI_MODELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  </div>
                  {aiCredentials && !aiCredentials.masterKeyConfigured && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">Configura AI_SECRETS_MASTER_KEY en el servidor para guardar claves cifradas.</p>}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Button type="button" size="sm" onClick={() => void handleSaveCredentials()} disabled={isSavingCredentials || !aiConfig.connectionConfigured || !modelInput.trim() || (!apiKeyInput.trim() && modelInput.trim() === aiCredentials?.model) || (Boolean(apiKeyInput.trim()) && !aiCredentials?.masterKeyConfigured)} className="rounded-lg text-xs"><KeyIcon className="h-4 w-4" />{isSavingCredentials ? "Guardando..." : apiKeyInput.trim() ? "Guardar clave" : "Guardar modelo"}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleTestCredentials()} disabled={isTestingCredentials || !aiCredentials?.configured || !aiConfig.connectionConfigured} className="rounded-lg text-xs"><ArrowPathIcon className={`h-4 w-4 ${isTestingCredentials ? "animate-spin" : ""}`} />Probar</Button>
                    {aiCredentials?.source === "DATABASE" && <Button type="button" size="sm" variant="outline" onClick={() => void handleDeleteCredentials()} disabled={isDeletingCredentials} className="col-span-2 rounded-lg text-xs text-red-600 sm:col-span-1"><TrashIcon className="h-4 w-4" />Eliminar</Button>}
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm">
                  <div><h4 className="text-sm font-semibold">Comportamiento</h4><p className="text-xs text-muted-foreground">Define como y cuando participa IA Kiments.</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium">Tono<select value={aiConfig.tono} onChange={(event) => setAiConfig({ ...aiConfig, tono: event.target.value as AiTone })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs"><option value="CERCANO">Cercano</option><option value="FORMAL">Formal</option><option value="COMERCIAL">Comercial</option><option value="PERSONALIZADO">Personalizado</option></select></label>
                    <label className="space-y-1 text-xs font-medium">Zona horaria<input value={aiConfig.zonaHoraria} readOnly className="h-10 w-full rounded-lg border border-input bg-muted/40 px-3 text-xs" /></label>
                  </div>
                  {aiConfig.tono === "PERSONALIZADO" && <label className="block space-y-1 text-xs font-medium">Instrucciones<textarea value={aiConfig.instruccionesPersonalizadas} maxLength={1000} onChange={(event) => setAiConfig({ ...aiConfig, instruccionesPersonalizadas: event.target.value })} className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" /><span className="block text-right text-[10px] text-muted-foreground">{aiConfig.instruccionesPersonalizadas.length}/1000</span></label>}
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <label className="flex items-start gap-3 text-xs">
                      <input type="checkbox" checked={aiConfig.naturalResponseEnabled} onChange={(event) => toggleNaturalResponse(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                      <span><span className="block font-semibold">Redaccion natural</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Gemini redacta respuestas informativas usando exclusivamente los datos validados del negocio.</span></span>
                    </label>
                    <label className="block space-y-1 text-xs font-medium">Despliegue de redaccion natural: {aiConfig.naturalResponseRolloutPercent}%<input type="range" min={0} max={100} step={5} value={aiConfig.naturalResponseRolloutPercent} disabled={!aiConfig.naturalResponseEnabled} onChange={(event) => setAiConfig({ ...aiConfig, naturalResponseRolloutPercent: Number(event.target.value) })} className="h-2 w-full accent-primary disabled:opacity-40" /></label>
                    <div className="grid gap-2 text-[10px] sm:grid-cols-2">
                      <div className="rounded-md bg-muted/40 p-2"><span className="font-semibold">Respuesta segura</span><p className="mt-1 text-muted-foreground">Productos disponibles: BELEN, EMMA y LYANA.</p></div>
                      <div className="rounded-md bg-primary/5 p-2"><span className="font-semibold text-primary">Respuesta natural</span><p className="mt-1 text-muted-foreground">Claro, bella. Tenemos BELEN, EMMA y LYANA disponibles. Dime cual deseas conocer.</p></div>
                    </div>
                  </div>
                  <div className="space-y-2"><p className="text-xs font-semibold">Dias y horario operativo</p><div className="grid grid-cols-7 gap-1">{AI_DAYS.map(([value, label]) => <button key={value} type="button" onClick={() => toggleAiListValue("diasAtencion", value)} className={`rounded-md border px-1 py-2 text-[9px] font-semibold ${aiConfig.diasAtencion.includes(value) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{label}</button>)}</div><div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-[10px] text-muted-foreground">Desde<input type="time" value={aiConfig.horaInicio} onChange={(event) => setAiConfig({ ...aiConfig, horaInicio: event.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><label className="space-y-1 text-[10px] text-muted-foreground">Hasta<input type="time" value={aiConfig.horaFin} onChange={(event) => setAiConfig({ ...aiConfig, horaFin: event.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label></div></div>
                  <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-xs font-medium">Espera (seg.)<input type="number" min={MIN_AI_RESPONSE_DELAY_SECONDS} max={MAX_AI_RESPONSE_DELAY_SECONDS} value={aiConfig.esperaRespuestaSegundos} onChange={(event) => setAiConfig({ ...aiConfig, esperaRespuestaSegundos: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><label className="space-y-1 text-xs font-medium">Max. respuestas<input type="number" min={MIN_AI_AUTOMATIC_RESPONSES} max={MAX_AI_AUTOMATIC_RESPONSES} value={aiConfig.maxRespuestasAutomaticas} onChange={(event) => setAiConfig({ ...aiConfig, maxRespuestasAutomaticas: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><label className="space-y-1 text-xs font-medium">Confianza minima<input type="number" min={50} max={95} value={aiConfig.confianzaMinima} onChange={(event) => setAiConfig({ ...aiConfig, confianzaMinima: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label></div>
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={aiConfig.transferirBajaConfianza} onChange={(event) => setAiConfig({ ...aiConfig, transferirBajaConfianza: event.target.checked })} className="h-4 w-4 accent-primary" />Transferir cuando la confianza sea baja</label>
                  <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={aiConfig.transferirImagenesAsesora} onChange={(event) => setAiConfig({ ...aiConfig, transferirImagenesAsesora: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" /><span><span className="block font-medium">Enviar conversaciones con imágenes a una asesora</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Cuando una clienta envíe una imagen, el chat pasará a una asesora sin responder automáticamente.</span></span></label>
                  <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={aiConfig.mostrarProductosNuevos} onChange={(event) => setAiConfig({ ...aiConfig, mostrarProductosNuevos: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" /><span><span className="block font-medium">Mostrar productos nuevos al iniciar un chat</span><span className="mt-0.5 block text-[10px] text-muted-foreground">En el primer contacto se enviarán los productos creados durante las últimas 72 horas, incluyendo preventa y fecha de envío.</span></span></label>
                  <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={aiConfig.mandarCatalogoImagenes} onChange={(event) => setAiConfig({ ...aiConfig, mandarCatalogoImagenes: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" /><span><span className="block font-medium">Mandar catálogo con imágenes</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Cuando una clienta pida el catálogo o pregunte qué productos venden, se enviarán los 3 productos más recientes con su imagen global antes de la respuesta de la IA.</span></span></label>
                  <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={aiConfig.sugerirPromocionesCarrito} onChange={(event) => setAiConfig({ ...aiConfig, sugerirPromocionesCarrito: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" /><span><span className="block font-medium">Sugerir promociones después del carrito</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Después del resumen se recomendarán hasta 3 promociones reales con descuento.</span></span></label>
                </section>


                <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                  <button type="button" aria-expanded={isIntentionsOpen} aria-controls="ai-intentions-content" onClick={() => setIsIntentionsOpen((current) => !current)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/30">
                    <div className="min-w-0 flex-1"><h4 className="text-sm font-semibold">Intenciones permitidas</h4><p className="text-xs text-muted-foreground">{aiConfig.intencionesPermitidas.length} temas habilitados</p></div>
                    <ChevronDownIcon className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isIntentionsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isIntentionsOpen && <div id="ai-intentions-content" className="grid gap-2 border-t border-border p-4 sm:grid-cols-2">{AI_INTENTS.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={aiConfig.intencionesPermitidas.includes(value)} onChange={() => toggleAiListValue("intencionesPermitidas", value)} className="h-3.5 w-3.5 accent-primary" /><span>{label}</span></label>)}</div>}
                </section>
              </div>

              <div className="space-y-4">
                <AiKnowledgeBasePanel enabled={aiConfig.connectionConfigured} />

                <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                  <button type="button" aria-expanded={isProductionControlOpen} aria-controls="ai-production-control-content" onClick={() => setIsProductionControlOpen((current) => !current)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/30">
                    <div className="min-w-0 flex-1"><h4 className="text-sm font-semibold">Control de produccion</h4><p className="text-xs text-muted-foreground">Limites, costos y despliegue automatico.</p></div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${aiConfig.operational.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : aiConfig.operational.status === "LIMITED" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{aiConfig.operational.status === "ACTIVE" ? "Operativo" : aiConfig.operational.status === "LIMITED" ? "Limitado" : "Detenido"}</span>
                    <ChevronDownIcon className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isProductionControlOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isProductionControlOpen && <div id="ai-production-control-content" className="space-y-4 border-t border-border p-4">
                    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium">Limite diario de tokens<input type="number" min={1} value={aiConfig.dailyTokenLimit ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, dailyTokenLimit: event.target.value ? Number(event.target.value) : null })} placeholder="Sin limite" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><label className="space-y-1 text-xs font-medium">Limite mensual de tokens<input type="number" min={1} value={aiConfig.monthlyTokenLimit ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, monthlyTokenLimit: event.target.value ? Number(event.target.value) : null })} placeholder="Sin limite" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><label className="space-y-1 text-xs font-medium">Presupuesto mensual USD<input type="number" min={0.0001} step="0.0001" value={aiConfig.monthlyBudgetUsd ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, monthlyBudgetUsd: event.target.value ? Number(event.target.value) : null })} placeholder="Sin limite" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><label className="space-y-1 text-xs font-medium">Despliegue automatico %<input type="number" min={0} max={100} value={aiConfig.automaticRolloutPercent} onChange={(event) => setAiConfig({ ...aiConfig, automaticRolloutPercent: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><label className="space-y-1 text-xs font-medium">Entrada / millon USD<input type="number" min={0} step="0.000001" value={aiConfig.inputCostPerMillionUsd ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, inputCostPerMillionUsd: event.target.value ? Number(event.target.value) : null })} placeholder="No configurado" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><label className="space-y-1 text-xs font-medium">Salida / millon USD<input type="number" min={0} step="0.000001" value={aiConfig.outputCostPerMillionUsd ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, outputCostPerMillionUsd: event.target.value ? Number(event.target.value) : null })} placeholder="No configurado" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label></div>
                    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-500/20 dark:bg-red-500/5"><label className="block space-y-1 text-xs font-medium">Motivo del cambio operativo<input value={controlReason} maxLength={300} onChange={(event) => setControlReason(event.target.value)} placeholder="Ej. mantenimiento o revision de consumo" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label><Button type="button" size="sm" variant="outline" disabled={isChangingAiControl} onClick={() => void handleAiControl(aiConfig.operational.status === "EMERGENCY_STOP" ? "ACTIVE" : "EMERGENCY_STOP")} className={`w-full rounded-lg text-xs ${aiConfig.operational.status === "EMERGENCY_STOP" ? "text-emerald-700" : "text-red-600"}`}><ExclamationTriangleIcon className="h-4 w-4" />{aiConfig.operational.status === "EMERGENCY_STOP" ? "Reactivar IA Kiments" : "Apagado inmediato"}</Button></div>
                  </div>}
                </section>

                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300"><ShieldCheckIcon className="h-5 w-5" />Reglas de seguridad</div><ul className="mt-3 space-y-1.5 text-xs text-emerald-800/80 dark:text-emerald-200/80">{aiConfig.reglasSeguridad.map((rule) => <li key={rule}>- {rule}</li>)}</ul></section>

              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isWhatsappModalOpen} onOpenChange={setIsWhatsappModalOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-border px-5 pb-3 pt-5 text-left">
            <DialogTitle>Conexion de WhatsApp</DialogTitle>
            <DialogDescription>
              Escanea el QR para conectar la cuenta o revisa el estado de la sesion actual.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                Consultando estado de WhatsApp...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            ) : status && currentStatus ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="whatsapp-branch" className="text-xs font-semibold uppercase text-muted-foreground">
                    Sucursal de venta
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="whatsapp-branch"
                      value={selectedBranchId}
                      onChange={(event) => setSelectedBranchId(event.target.value)}
                      disabled={isLoadingBranches || isSavingBranch}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">{isLoadingBranches ? "Cargando..." : "Seleccionar sucursal"}</option>
                      {branches.map((branch) => (
                        <option key={branch.idSucursal} value={branch.idSucursal}>
                          {branch.nombreSucursal}
                        </option>
                      ))}
                    </select>
                    <Button onClick={() => void handleSaveBranch()} disabled={isSavingBranch || !selectedBranchId}>
                      {isSavingBranch ? "Guardando..." : status.connectionConfigured ? "Cambiar" : "Vincular"}
                    </Button>
                  </div>
                  {!status.connectionConfigured && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Vincula una sucursal para habilitar stock, ventas e inteligencia artificial.
                    </p>
                  )}
                </div>

                {status.phoneChanged && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Confirma el cambio de numero</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">
                      Las conversaciones anteriores responderan desde {status.connectedNumber || "el nuevo numero"} despues de tu confirmacion.
                    </p>
                    <Button type="button" size="sm" onClick={() => void handleAcknowledgePhoneChange()} disabled={isAcknowledgingPhoneChange} className="mt-3 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                      {isAcknowledgingPhoneChange ? "Confirmando..." : "Usar nuevo numero"}
                    </Button>
                  </div>
                )}

                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <span className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${currentStatus.className}`}>
                    {status.status === "CONNECTED" ? (
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                    ) : (
                      <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    )}
                    {currentStatus.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{currentStatus.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {status.connectedNumber ? `Numero: ${status.connectedNumber}` : "Numero aun no conectado"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ultima actividad: {formatDate(status.lastActivityAt)}
                    </p>
                    {status.branch && (
                      <p className="mt-1 text-xs font-medium text-foreground">
                        Sucursal: {status.branch.nombreSucursal}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-4">
                  {!status.connectionConfigured ? (
                    <div className="text-center">
                      <ExclamationTriangleIcon className="mx-auto h-11 w-11 text-amber-500" />
                      <p className="mt-3 text-sm font-semibold text-foreground">Selecciona una sucursal de venta</p>
                      <p className="mt-1 text-xs text-muted-foreground">Luego podras conectar WhatsApp y utilizar su stock.</p>
                    </div>
                  ) : status.status === "CONNECTED" ? (
                    <div className="text-center">
                      <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-500" />
                      <p className="mt-3 text-sm font-semibold text-foreground">WhatsApp ya esta conectado</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Puedes cerrar este modal y seguir usando el CRM.
                      </p>
                    </div>
                  ) : qrDataUrl ? (
                    <Image
                      src={qrDataUrl}
                      alt="QR para conectar WhatsApp"
                      width={224}
                      height={224}
                      unoptimized
                      className="h-56 w-56 rounded-lg bg-white p-2"
                    />
                  ) : (
                    <div className="text-center">
                      <QrCodeIcon className="mx-auto h-11 w-11 text-muted-foreground/40" />
                      <p className="mt-3 text-sm font-semibold text-muted-foreground">QR no disponible</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {status.status === "QR_REQUIRED"
                          ? "Espera unos segundos o actualiza el estado."
                          : "El codigo aparecera cuando WhatsApp lo solicite."}
                      </p>
                    </div>
                  )}
                </div>

                {status.status !== "CONNECTED" && status.lastError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    {status.lastError.toLowerCase().includes("fetch failed")
                      ? "No se pudo comunicar con WhatsApp. Intenta actualizar nuevamente."
                      : status.lastError}
                  </p>
                )}

                <section className="hidden" aria-hidden="true">
                  <button
                    type="button"
                    onClick={() => setAiExpanded((current) => !current)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      <SparklesIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">Configuracion de IA Kiments</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {aiConfig?.modo === "AUTOMATICA" ? "Respuestas automaticas" : aiConfig?.modo === "SUGERENCIAS" ? "Solo sugerencias" : "IA Kiments desactivada"}
                      </span>
                    </span>
                    <ChevronDownIcon className={`h-4 w-4 text-muted-foreground transition ${aiExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {aiExpanded && (
                    <div className="space-y-4 border-t border-border px-4 py-4">
                      {isLoadingAi || !aiConfig ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                          <ArrowPathIcon className="h-4 w-4 animate-spin" /> Cargando configuracion...
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                            <div className="flex items-start gap-2">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                                <KeyIcon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold">Proveedor Gemini</span>
                                <span className="block text-[10px] text-muted-foreground">
                                  {aiCredentials?.configured
                                    ? `Credencial activa (${aiCredentials.source === "DATABASE" ? "guardada en CRM" : "configurada en servidor"})`
                                    : "Sin API key configurada"}
                                </span>
                              </span>
                              <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${aiCredentials?.configured ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>
                                {aiCredentials?.configured ? "Configurada" : "Pendiente"}
                              </span>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
                              <label className="space-y-1 text-[10px] font-medium">
                                {aiCredentials?.source === "DATABASE" ? "Nueva API key (para reemplazar)" : "API key"}
                                <input
                                  type="password"
                                  value={apiKeyInput}
                                  autoComplete="new-password"
                                  onChange={(event) => setApiKeyInput(event.target.value)}
                                  placeholder={aiCredentials?.configured ? aiCredentials.maskedKey : "AIza..."}
                                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                />
                              </label>
                              <label className="space-y-1 text-[10px] font-medium">
                                Modelo
                                <input
                                  value={modelInput}
                                  onChange={(event) => setModelInput(event.target.value)}
                                  placeholder="gemini-3.8-flash"
                                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                                />
                              </label>
                            </div>

                            {aiCredentials && !aiCredentials.masterKeyConfigured && (
                              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                                Configura AI_SECRETS_MASTER_KEY una sola vez en el servidor para guardar claves cifradas desde el CRM.
                              </div>
                            )}

                            {aiCredentials?.updatedAt && aiCredentials.source === "DATABASE" && (
                              <p className="text-[10px] text-muted-foreground">
                                Ultimo cambio: {formatDate(aiCredentials.updatedAt)}{aiCredentials.updatedBy ? ` por ${aiCredentials.updatedBy}` : ""}.
                              </p>
                            )}

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleSaveCredentials()}
                                disabled={
                                  isSavingCredentials
                                  || !aiConfig.connectionConfigured
                                  || !modelInput.trim()
                                  || (!apiKeyInput.trim() && modelInput.trim() === aiCredentials?.model)
                                  || (Boolean(apiKeyInput.trim()) && !aiCredentials?.masterKeyConfigured)
                                }
                                className="h-8 rounded-lg text-[10px]"
                              >
                                {isSavingCredentials ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <KeyIcon className="h-3.5 w-3.5" />}
                                {apiKeyInput.trim() ? (aiCredentials?.configured ? "Reemplazar clave" : "Guardar clave") : "Guardar modelo"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleTestCredentials()}
                                disabled={isTestingCredentials || !aiCredentials?.configured || !aiConfig.connectionConfigured}
                                className="h-8 rounded-lg text-[10px]"
                              >
                                <ArrowPathIcon className={`h-3.5 w-3.5 ${isTestingCredentials ? "animate-spin" : ""}`} />
                                Probar
                              </Button>
                              {aiCredentials?.source === "DATABASE" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleDeleteCredentials()}
                                  disabled={isDeletingCredentials}
                                  className="col-span-2 h-8 rounded-lg text-[10px] text-red-600 hover:text-red-700 sm:col-span-1"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                  Eliminar
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 rounded-lg bg-muted p-1">
                            {(["DESACTIVADA", "SUGERENCIAS", "AUTOMATICA"] as AiMode[]).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                disabled={mode !== "DESACTIVADA" && (!aiConfig.connectionConfigured || !aiCredentials?.configured)}
                                onClick={() => setAiConfig({ ...aiConfig, modo: mode })}
                                className={`min-w-0 rounded-md px-2 py-2 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${aiConfig.modo === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                              >
                                {mode === "DESACTIVADA" ? "Desactivada" : mode === "SUGERENCIAS" ? "Sugerencias" : "Automatica"}
                              </button>
                            ))}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1 text-xs font-medium">
                              Tono de atencion
                              <select
                                value={aiConfig.tono}
                                onChange={(event) => setAiConfig({ ...aiConfig, tono: event.target.value as AiTone })}
                                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs"
                              >
                                <option value="CERCANO">Cercano</option>
                                <option value="FORMAL">Formal</option>
                                <option value="COMERCIAL">Comercial</option>
                                <option value="PERSONALIZADO">Personalizado</option>
                              </select>
                            </label>
                            <label className="space-y-1 text-xs font-medium">
                              Zona horaria
                              <input value={aiConfig.zonaHoraria} readOnly className="h-9 w-full rounded-lg border border-input bg-muted/40 px-3 text-xs" />
                            </label>
                          </div>

                          {aiConfig.tono === "PERSONALIZADO" && (
                            <label className="block space-y-1 text-xs font-medium">
                              Instrucciones del tono
                              <textarea
                                value={aiConfig.instruccionesPersonalizadas}
                                maxLength={1000}
                                onChange={(event) => setAiConfig({ ...aiConfig, instruccionesPersonalizadas: event.target.value })}
                                placeholder="Describe como debe comunicarse IA Kiments..."
                                className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                              />
                              <span className="block text-right text-[10px] text-muted-foreground">{aiConfig.instruccionesPersonalizadas.length}/1000</span>
                            </label>
                          )}

                          <div className="space-y-3 rounded-lg border border-border p-3">
                            <label className="flex items-start gap-3 text-xs">
                              <input type="checkbox" checked={aiConfig.naturalResponseEnabled} onChange={(event) => toggleNaturalResponse(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                              <span><span className="block font-semibold">Redaccion natural</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Redacta consultas informativas con Gemini y conserva respuestas seguras como respaldo.</span></span>
                            </label>
                            <label className="block space-y-1 text-[10px] font-medium">Despliegue: {aiConfig.naturalResponseRolloutPercent}%<input type="range" min={0} max={100} step={5} value={aiConfig.naturalResponseRolloutPercent} disabled={!aiConfig.naturalResponseEnabled} onChange={(event) => setAiConfig({ ...aiConfig, naturalResponseRolloutPercent: Number(event.target.value) })} className="h-2 w-full accent-primary disabled:opacity-40" /></label>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-semibold">Dias y horario</p>
                            <div className="grid grid-cols-7 gap-1">
                              {AI_DAYS.map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => toggleAiListValue("diasAtencion", value)}
                                  className={`rounded-md border px-1 py-1.5 text-[9px] font-semibold ${aiConfig.diasAtencion.includes(value) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                                >{label}</button>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1 text-[10px] text-muted-foreground">Desde<input type="time" value={aiConfig.horaInicio} onChange={(event) => setAiConfig({ ...aiConfig, horaInicio: event.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                              <label className="space-y-1 text-[10px] text-muted-foreground">Hasta<input type="time" value={aiConfig.horaFin} onChange={(event) => setAiConfig({ ...aiConfig, horaFin: event.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-semibold">Intenciones permitidas</p>
                            <div className="grid grid-cols-2 gap-2">
                              {AI_INTENTS.map(([value, label]) => (
                                <label key={value} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-[11px]">
                                  <input type="checkbox" checked={aiConfig.intencionesPermitidas.includes(value)} onChange={() => toggleAiListValue("intencionesPermitidas", value)} className="h-3.5 w-3.5 accent-primary" />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <label className="space-y-1 text-[10px] font-medium">Espera (seg.)<input type="number" min={MIN_AI_RESPONSE_DELAY_SECONDS} max={MAX_AI_RESPONSE_DELAY_SECONDS} value={aiConfig.esperaRespuestaSegundos} onChange={(event) => setAiConfig({ ...aiConfig, esperaRespuestaSegundos: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                            <label className="space-y-1 text-[10px] font-medium">Max. respuestas<input type="number" min={MIN_AI_AUTOMATIC_RESPONSES} max={MAX_AI_AUTOMATIC_RESPONSES} value={aiConfig.maxRespuestasAutomaticas} onChange={(event) => setAiConfig({ ...aiConfig, maxRespuestasAutomaticas: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                            <label className="space-y-1 text-[10px] font-medium">Confianza minima<input type="number" min={50} max={95} value={aiConfig.confianzaMinima} onChange={(event) => setAiConfig({ ...aiConfig, confianzaMinima: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                          </div>

                          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                            <input type="checkbox" checked={aiConfig.transferirBajaConfianza} onChange={(event) => setAiConfig({ ...aiConfig, transferirBajaConfianza: event.target.checked })} className="h-4 w-4 accent-primary" />
                            Transferir cuando la confianza sea baja
                          </label>

                          <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                            <input type="checkbox" checked={aiConfig.transferirImagenesAsesora} onChange={(event) => setAiConfig({ ...aiConfig, transferirImagenesAsesora: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
                            <span><span className="block font-medium">Enviar conversaciones con imágenes a una asesora</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Cuando una clienta envíe una imagen, el chat pasará a una asesora sin responder automáticamente.</span></span>
                          </label>

                          <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                            <input type="checkbox" checked={aiConfig.mostrarProductosNuevos} onChange={(event) => setAiConfig({ ...aiConfig, mostrarProductosNuevos: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
                            <span><span className="block font-medium">Mostrar productos nuevos al iniciar un chat</span><span className="mt-0.5 block text-[10px] text-muted-foreground">En el primer contacto se enviarán los productos creados durante las últimas 72 horas, incluyendo preventa y fecha de envío.</span></span>
                          </label>

                          <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                            <input type="checkbox" checked={aiConfig.mandarCatalogoImagenes} onChange={(event) => setAiConfig({ ...aiConfig, mandarCatalogoImagenes: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
                            <span><span className="block font-medium">Mandar catálogo con imágenes</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Cuando una clienta pida el catálogo o pregunte qué productos venden, se enviarán los 3 productos más recientes con su imagen global antes de la respuesta de la IA.</span></span>
                          </label>

                          <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                            <input type="checkbox" checked={aiConfig.sugerirPromocionesCarrito} onChange={(event) => setAiConfig({ ...aiConfig, sugerirPromocionesCarrito: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
                            <span><span className="block font-medium">Sugerir promociones después del carrito</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Después del resumen se recomendarán hasta 3 promociones reales con descuento.</span></span>
                          </label>

                          <section className="space-y-3 border-y border-border py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold">Control de produccion</p>
                                <p className="text-[10px] text-muted-foreground">Limites, costos estimados y despliegue automatico.</p>
                              </div>
                              <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${aiConfig.operational.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : aiConfig.operational.status === "LIMITED" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"}`}>
                                {aiConfig.operational.status === "ACTIVE" ? "Operativo" : aiConfig.operational.status === "LIMITED" ? "Solo sugerencias" : "Detenido"}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-3">
                              <div className="rounded-lg bg-muted/50 px-2.5 py-2"><span className="block text-muted-foreground">Tokens hoy</span><b>{aiConfig.operational.dailyTokens.toLocaleString("es-PE")}</b></div>
                              <div className="rounded-lg bg-muted/50 px-2.5 py-2"><span className="block text-muted-foreground">Tokens del mes</span><b>{aiConfig.operational.monthlyTokens.toLocaleString("es-PE")}</b></div>
                              <div className="col-span-2 rounded-lg bg-muted/50 px-2.5 py-2 sm:col-span-1"><span className="block text-muted-foreground">Costo estimado</span><b>US$ {Number(aiConfig.operational.monthlyCostUsd || 0).toFixed(4)}</b></div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1 text-[10px] font-medium">Limite diario de tokens<input type="number" min={1} value={aiConfig.dailyTokenLimit ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, dailyTokenLimit: event.target.value ? Number(event.target.value) : null })} placeholder="Sin limite" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                              <label className="space-y-1 text-[10px] font-medium">Limite mensual de tokens<input type="number" min={1} value={aiConfig.monthlyTokenLimit ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, monthlyTokenLimit: event.target.value ? Number(event.target.value) : null })} placeholder="Sin limite" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                              <label className="space-y-1 text-[10px] font-medium">Presupuesto mensual USD<input type="number" min={0.0001} step="0.0001" value={aiConfig.monthlyBudgetUsd ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, monthlyBudgetUsd: event.target.value ? Number(event.target.value) : null })} placeholder="Sin limite" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                              <label className="space-y-1 text-[10px] font-medium">Despliegue automatico<input type="number" min={0} max={100} value={aiConfig.automaticRolloutPercent} onChange={(event) => setAiConfig({ ...aiConfig, automaticRolloutPercent: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                              <label className="space-y-1 text-[10px] font-medium">Entrada / millon USD<input type="number" min={0} step="0.000001" value={aiConfig.inputCostPerMillionUsd ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, inputCostPerMillionUsd: event.target.value ? Number(event.target.value) : null })} placeholder="No configurado" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                              <label className="space-y-1 text-[10px] font-medium">Salida / millon USD<input type="number" min={0} step="0.000001" value={aiConfig.outputCostPerMillionUsd ?? ""} onChange={(event) => setAiConfig({ ...aiConfig, outputCostPerMillionUsd: event.target.value ? Number(event.target.value) : null })} placeholder="No configurado" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                            </div>

                            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-500/20 dark:bg-red-500/5">
                              <label className="block space-y-1 text-[10px] font-medium">Motivo del cambio operativo<input value={controlReason} maxLength={300} onChange={(event) => setControlReason(event.target.value)} placeholder="Ej. mantenimiento o revision de consumo" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /></label>
                              <Button type="button" size="sm" variant="outline" disabled={isChangingAiControl} onClick={() => void handleAiControl(aiConfig.operational.status === "EMERGENCY_STOP" ? "ACTIVE" : "EMERGENCY_STOP")} className={`h-8 w-full rounded-lg text-[10px] ${aiConfig.operational.status === "EMERGENCY_STOP" ? "text-emerald-700" : "text-red-600"}`}>
                                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                                {aiConfig.operational.status === "EMERGENCY_STOP" ? "Reactivar IA Kiments" : "Apagado inmediato"}
                              </Button>
                            </div>
                          </section>

                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300"><ShieldCheckIcon className="h-4 w-4" /> Reglas de seguridad</div>
                            <ul className="mt-2 space-y-1 text-[10px] text-emerald-800/80 dark:text-emerald-200/80">
                              {aiConfig.reglasSeguridad.map((rule) => <li key={rule}>- {rule}</li>)}
                            </ul>
                          </div>

                          <div className="rounded-lg bg-muted/50 px-3 py-2 text-[10px] text-muted-foreground">
                            {aiConfig.modo === "DESACTIVADA" ? "IA Kiments no generara respuestas." : aiConfig.modo === "SUGERENCIAS" ? "Los asesores solicitaran y revisaran cada borrador." : `Respondera automaticamente de ${aiConfig.horaInicio} a ${aiConfig.horaFin} en ${aiConfig.branch?.nombreSucursal || "la sucursal vinculada"}.`}
                          </div>

                          <Button className="w-full rounded-xl" onClick={() => void handleSaveAi()} disabled={isSavingAi || !aiConfig.connectionConfigured}>
                            <SparklesIcon className="h-4 w-4" />
                            {isSavingAi ? "Guardando..." : "Guardar configuracion de IA Kiments"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </section>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => void loadConnection()}
                    disabled={isRefreshing}
                    className="w-full rounded-xl"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    {isRefreshing ? "Actualizando..." : "Actualizar estado"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    disabled={isLoggingOut || status.status === "INITIALIZING"}
                    className="w-full rounded-xl"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    {isLoggingOut ? "Cerrando..." : "Cerrar sesion WhatsApp"}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
