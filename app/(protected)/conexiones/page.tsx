"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  BookOpenIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  PlusIcon,
  QrCodeIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authFetch } from "@/lib/auth/auth-fetch"

type WhatsappStatusValue = "INITIALIZING" | "QR_REQUIRED" | "CONNECTED" | "DISCONNECTED" | "AUTH_FAILURE"

interface WhatsappBranch {
  idSucursal: number
  nombreSucursal: string
  tipoSucursal: string
}

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

interface WhatsappQrResponse extends WhatsappStatus {
  qr?: string
  qrDataUrl?: string
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

interface AgentConfig {
  connectionId: number
  enabled: boolean
  model: string
  automaticSalesEnabled: boolean
  messageGroupingMs: number
  paymentReservationSeconds: number
  receiptMinimumConfidence: number
  advisorAttentionEnabled: boolean
  jobMaxAttempts: number
  outboxMaxAttempts: number
  maxMessagesPerBatch: number
  maxToolCallsPerRun: number
  maxOutputMessagesPerRun: number
  welcomeMessage: string
  agentBehaviorInstructions: string
  monitoring: AgentMonitoring
}

interface AgentMonitoring {
  available: boolean
  since: string | null
  health: "HEALTHY" | "WATCH" | "ALERT" | "UNAVAILABLE"
  sessions: number
  completedJobs: number
  failedJobs: number
  suppressedResponses: number
  failedTools: number
  sentOutputs: number
  failedOutputs: number
  pendingOutputs: number
  duplicateReceipts: number
  automaticSales: number
}

interface ShalomAgencySyncStatus {
  running: boolean
  totalAgencies: number
  availableDestinations: number
  lastStatus: "NEVER" | "RUNNING" | "SUCCESS" | "FAILED"
  lastStartedAt: string | null
  lastSuccessfulAt: string | null
  lastError: string | null
  received: number
  created: number
  updated: number
  deactivated: number
}

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  connectionId: 0,
  enabled: false,
  model: "gemini-3.8-flash",
  automaticSalesEnabled: false,
  messageGroupingMs: 5000,
  paymentReservationSeconds: 240,
  receiptMinimumConfidence: 85,
  advisorAttentionEnabled: false,
  jobMaxAttempts: 3,
  outboxMaxAttempts: 5,
  maxMessagesPerBatch: 15,
  maxToolCallsPerRun: 12,
  maxOutputMessagesPerRun: 6,
  welcomeMessage: `💕 *¡Bienvenida a Kiments!*

Antes de realizar tu compra, revisa cuidadosamente el *modelo, color y talla* seleccionados.

⚠️ *IMPORTANTE SOBRE LOS CAMBIOS*
Evita solicitar cambios después de confirmar tu pedido. Este proceso puede tomar más tiempo y tiene una *penalidad de S/20.00 por cada cambio de prenda*.

Por favor, asegúrate de elegir correctamente tu *talla, modelo y color* antes de continuar. Si tienes alguna duda, consúltanos antes de confirmar tu compra.

🎨 Los tonos pueden variar ligeramente según la iluminación o la pantalla.
📅 Los productos en preventa se despachan desde la fecha indicada.
🚚 Realizamos envíos mediante Shalom.
🏬 También puedes recoger tu pedido en nuestra tienda de Gamarra.`,
  agentBehaviorInstructions: `Habla como una asesora de ventas femenina, cálida, amable y cercana.
Puedes llamar a la clienta “bella”, “hermosa” o “linda” de manera moderada y natural, sin repetirlo en cada mensaje.
Responde en español, de forma breve, clara y profesional, con pocos emojis.
Acompaña a la clienta hacia la compra sin presionarla y evita respuestas frías, robóticas o repetitivas.`,
  monitoring: { available: false, since: null, health: "UNAVAILABLE", sessions: 0, completedJobs: 0,
    failedJobs: 0, suppressedResponses: 0, failedTools: 0, sentOutputs: 0, failedOutputs: 0,
    pendingOutputs: 0, duplicateReceipts: 0, automaticSales: 0 },
}

type KnowledgeCategory = "POLITICAS" | "HORARIOS" | "UBICACION" | "ENVIOS" | "CUIDADOS" | "FAQ"

interface KnowledgeArticle {
  id: number
  title: string
  category: KnowledgeCategory
  content: string
  keywords: string | null
  status: "BORRADOR" | "INDEXANDO" | "ACTIVO" | "ERROR"
  active: boolean
  version: number
  lastError: string | null
  indexedAt: string | null
  updatedAt: string
}

interface KnowledgeForm {
  id: number | null
  title: string
  category: KnowledgeCategory
  content: string
  keywords: string
  active: boolean
}

const EMPTY_KNOWLEDGE_FORM: KnowledgeForm = {
  id: null, title: "", category: "FAQ", content: "", keywords: "", active: true,
}

const KNOWLEDGE_CATEGORIES: ReadonlyArray<{ value: KnowledgeCategory; label: string }> = [
  { value: "POLITICAS", label: "Políticas" },
  { value: "HORARIOS", label: "Horarios" },
  { value: "UBICACION", label: "Ubicación" },
  { value: "ENVIOS", label: "Envíos" },
  { value: "CUIDADOS", label: "Cuidados" },
  { value: "FAQ", label: "Preguntas frecuentes" },
]

const GEMINI_MODELS = [
  ["gemini-3.8-flash", "Gemini 3.8 Flash - Recomendado"],
  ["gemini-3.6-flash", "Gemini 3.6 Flash - Equilibrado"],
  ["gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite - Económico"],
  ["gemini-3.7-flash", "Gemini 3.7 Flash - Heredado, redirige a 3.8"],
  ["gemini-3.5-flash", "Gemini 3.5 Flash - Heredado, redirige a 3.6"],
  ["gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite - Heredado"],
  ["gemini-3.1-pro-preview", "Gemini 3.1 Pro - Preview"],
  ["gemini-3-flash-preview", "Gemini 3 Flash - Preview"],
  ["gemini-2.5-flash", "Gemini 2.5 Flash - Acceso restringido"],
  ["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite - Acceso restringido"],
  ["gemini-2.5-pro", "Gemini 2.5 Pro - Acceso restringido"],
] as const

const statusMap: Record<WhatsappStatusValue, { label: string; description: string; className: string }> = {
  INITIALIZING: { label: "Inicializando", description: "Preparando la sesión de WhatsApp Web.", className: "bg-sky-100 text-sky-700" },
  QR_REQUIRED: { label: "QR requerido", description: "Escanea el código con el WhatsApp principal de Kiments.", className: "bg-amber-100 text-amber-700" },
  CONNECTED: { label: "Conectado", description: "WhatsApp está listo para recibir mensajes.", className: "bg-emerald-100 text-emerald-700" },
  DISCONNECTED: { label: "Desconectado", description: "La sesión de WhatsApp no está activa.", className: "bg-red-100 text-red-700" },
  AUTH_FAILURE: { label: "Error de autenticación", description: "WhatsApp rechazó la sesión. Vuelve a escanear el QR.", className: "bg-red-100 text-red-700" },
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
  const [activeTab, setActiveTab] = useState<"whatsapp" | "ai">("whatsapp")
  const [aiTab, setAiTab] = useState<"gemini" | "rag" | "agent">("gemini")
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
  const [isShalomModalOpen, setIsShalomModalOpen] = useState(false)
  const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false)
  const [aiCredentials, setAiCredentials] = useState<AiCredentials | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [modelInput, setModelInput] = useState("gemini-3.8-flash")
  const [isSavingCredentials, setIsSavingCredentials] = useState(false)
  const [isTestingCredentials, setIsTestingCredentials] = useState(false)
  const [isDeletingCredentials, setIsDeletingCredentials] = useState(false)
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [isLoadingAgentConfig, setIsLoadingAgentConfig] = useState(true)
  const [isSavingAgentConfig, setIsSavingAgentConfig] = useState(false)
  const [shalomSync, setShalomSync] = useState<ShalomAgencySyncStatus | null>(null)
  const [isSyncingShalom, setIsSyncingShalom] = useState(false)
  const [knowledge, setKnowledge] = useState<KnowledgeArticle[]>([])
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeForm>(EMPTY_KNOWLEDGE_FORM)
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false)
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(true)
  const [isSavingKnowledge, setIsSavingKnowledge] = useState(false)
  const [knowledgeQuestion, setKnowledgeQuestion] = useState("")
  const [knowledgeTestResult, setKnowledgeTestResult] = useState<string[]>([])
  const [isTestingKnowledge, setIsTestingKnowledge] = useState(false)

  const loadConnection = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/status", { cache: "no-store" })
      if (!response.ok) throw new Error(await readMessage(response, "Microservicio de WhatsApp no disponible"))
      const nextStatus = (await response.json()) as WhatsappStatus
      setStatus(nextStatus)
      setSelectedBranchId((current) => current || (nextStatus.branch ? String(nextStatus.branch.idSucursal) : ""))
      setError(null)
      if (nextStatus.connectionConfigured && nextStatus.status === "QR_REQUIRED" && nextStatus.hasQr) {
        const qrResponse = await authFetch("/api/crm/whatsapp/qr", { cache: "no-store" })
        if (qrResponse.ok) setQrDataUrl(((await qrResponse.json()) as WhatsappQrResponse).qrDataUrl || null)
      } else {
        setQrDataUrl(null)
      }
    } catch (requestError) {
      setStatus(null)
      setQrDataUrl(null)
      setError(requestError instanceof Error ? requestError.message : "Microservicio de WhatsApp no disponible")
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
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudieron cargar las sucursales")
    } finally {
      setIsLoadingBranches(false)
    }
  }, [])

  const loadCredentials = useCallback(async () => {
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-credentials", { cache: "no-store" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo cargar la conexión con Gemini"))
      const credentials = (await response.json()) as AiCredentials
      setAiCredentials(credentials)
      setModelInput(credentials.model || "gemini-3.8-flash")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo cargar la conexión con Gemini")
    }
  }, [])

  const loadAgentConfig = useCallback(async () => {
    setIsLoadingAgentConfig(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/agent-config", { cache: "no-store" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo cargar la configuracion del agente"))
      const config = (await response.json()) as AgentConfig
      setAgentConfig({ ...DEFAULT_AGENT_CONFIG, ...config, monitoring: { ...DEFAULT_AGENT_CONFIG.monitoring, ...config.monitoring } })
      setModelInput(config.model || "gemini-3.8-flash")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo cargar la configuracion del agente")
    } finally {
      setIsLoadingAgentConfig(false)
    }
  }, [])

  const loadKnowledge = useCallback(async () => {
    setIsLoadingKnowledge(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/knowledge", { cache: "no-store" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo cargar la base de conocimiento"))
      setKnowledge((await response.json()) as KnowledgeArticle[])
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo cargar la base de conocimiento")
    } finally {
      setIsLoadingKnowledge(false)
    }
  }, [])

  const loadShalomSync = useCallback(async () => {
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/shalom-agencies/status", { cache: "no-store" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo consultar el catálogo de Shalom"))
      setShalomSync((await response.json()) as ShalomAgencySyncStatus)
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo consultar el catálogo de Shalom")
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConnection()
      void loadCredentials()
      void loadAgentConfig()
      void loadKnowledge()
      void loadShalomSync()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadAgentConfig, loadConnection, loadCredentials, loadKnowledge, loadShalomSync])

  const handleSyncShalom = async () => {
    setIsSyncingShalom(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/shalom-agencies/sync", { method: "POST" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudieron actualizar las agencias"))
      setShalomSync((await response.json()) as ShalomAgencySyncStatus)
      toast.success("Catálogo de agencias Shalom actualizado")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudieron actualizar las agencias")
      await loadShalomSync()
    } finally {
      setIsSyncingShalom(false)
    }
  }

  useEffect(() => {
    if (!isWhatsappModalOpen) return
    const timeoutId = window.setTimeout(() => {
      void loadConnection()
      void loadBranches()
    }, 0)
    const intervalId = window.setInterval(() => void loadConnection(), 4000)
    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [isWhatsappModalOpen, loadBranches, loadConnection])

  const handleSaveBranch = async () => {
    const idSucursal = Number(selectedBranchId)
    if (!Number.isFinite(idSucursal) || idSucursal <= 0) return toast.error("Selecciona una sucursal de venta")
    if (status?.branch && status.branch.idSucursal !== idSucursal && status.status === "CONNECTED"
      && !window.confirm("La nueva sucursal se usará para el stock y las ventas futuras de WhatsApp. ¿Continuar?")) return
    setIsSavingBranch(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/branch", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idSucursal }),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo vincular la sucursal"))
      toast.success("Sucursal vinculada con WhatsApp")
      await loadConnection()
      await loadCredentials()
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo vincular la sucursal")
    } finally {
      setIsSavingBranch(false)
    }
  }

  const handleSaveCredentials = async () => {
    const apiKey = apiKeyInput.trim()
    if (apiKey && apiKey.length < 20) return toast.error("Ingresa una API key de Gemini válida")
    if (!apiKey && !aiCredentials?.configured) return toast.error("Ingresa una API key de Gemini")
    if (!modelInput.trim()) return toast.error("Selecciona el modelo de Gemini")
    setIsSavingCredentials(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-credentials", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model: modelInput.trim() }),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo guardar la credencial"))
      const credentials = (await response.json()) as AiCredentials
      setAiCredentials(credentials)
      setModelInput(credentials.model)
      setApiKeyInput("")
      toast.success(apiKey ? "Credencial y modelo guardados" : "Modelo actualizado")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo guardar la credencial")
    } finally {
      setIsSavingCredentials(false)
    }
  }

  const handleTestCredentials = async () => {
    setIsTestingCredentials(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-credentials/test", { method: "POST" })
      if (!response.ok) throw new Error(await readMessage(response, "Gemini rechazó la credencial"))
      const result = (await response.json()) as { model: string; latencyMs: number }
      toast.success(`Conexión correcta con ${result.model} (${result.latencyMs} ms)`)
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo validar Gemini")
    } finally {
      setIsTestingCredentials(false)
    }
  }

  const handleDeleteCredentials = async () => {
    if (!window.confirm("¿Eliminar la API key guardada en el CRM?")) return
    setIsDeletingCredentials(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-credentials", { method: "DELETE" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo eliminar la API key"))
      const credentials = (await response.json()) as AiCredentials
      setAiCredentials(credentials)
      setModelInput(credentials.model)
      setApiKeyInput("")
      setAgentConfig((current) => ({ ...current, enabled: false }))
      toast.success("API key eliminada")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo eliminar la API key")
    } finally {
      setIsDeletingCredentials(false)
    }
  }

  const updateAgentNumber = (field: keyof AgentConfig, value: string) => {
    const numeric = Number(value)
    setAgentConfig((current) => ({ ...current, [field]: Number.isFinite(numeric) ? numeric : 0 }))
  }

  const handleSaveAgentConfig = async () => {
    if (agentConfig.enabled && !aiCredentials?.configured) {
      return toast.error("Configura una API key de Gemini antes de activar el agente")
    }
    setIsSavingAgentConfig(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...agentConfig, model: modelInput.trim() }),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo guardar la configuracion"))
      const saved = (await response.json()) as AgentConfig
      setAgentConfig(saved)
      setModelInput(saved.model)
      toast.success(saved.enabled ? "Agente activado y configuracion aplicada" : "Agente detenido y configuracion guardada")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo guardar la configuracion")
    } finally {
      setIsSavingAgentConfig(false)
    }
  }

  const handleSaveKnowledge = async () => {
    if (!knowledgeForm.title.trim()) return toast.error("Escribe un título")
    if (!knowledgeForm.content.trim()) return toast.error("Escribe el contenido que utilizará la IA")
    setIsSavingKnowledge(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(knowledgeForm),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo guardar el conocimiento"))
      const saved = (await response.json()) as KnowledgeArticle
      if (saved.status === "ERROR") toast.error(saved.lastError || "No se pudo indexar el conocimiento")
      else toast.success(saved.active ? "Conocimiento publicado e indexado" : "Conocimiento guardado como borrador")
      setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)
      setIsKnowledgeModalOpen(false)
      await loadKnowledge()
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo guardar el conocimiento")
    } finally {
      setIsSavingKnowledge(false)
    }
  }

  const handleEditKnowledge = (article: KnowledgeArticle) => {
    setKnowledgeForm({
      id: article.id,
      title: article.title,
      category: article.category,
      content: article.content,
      keywords: article.keywords ?? "",
      active: article.active,
    })
    setIsKnowledgeModalOpen(true)
  }

  const handleDeleteKnowledge = async (article: KnowledgeArticle) => {
    if (!window.confirm(`¿Eliminar “${article.title}” de la base de conocimiento?`)) return
    try {
      const response = await authFetch(`/api/crm/whatsapp/connection/knowledge/${article.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo eliminar el conocimiento"))
      if (knowledgeForm.id === article.id) setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)
      toast.success("Conocimiento eliminado")
      await loadKnowledge()
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo eliminar el conocimiento")
    }
  }

  const handleTestKnowledge = async () => {
    if (!knowledgeQuestion.trim()) return toast.error("Escribe una pregunta")
    setIsTestingKnowledge(true)
    setKnowledgeTestResult([])
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/knowledge/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: knowledgeQuestion.trim() }),
      })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo consultar el RAG"))
      const result = (await response.json()) as { sources: Array<{ title: string; content: string; score: number }> }
      setKnowledgeTestResult(result.sources.map((source) => `${source.title} (${Math.round(source.score * 100)}%): ${source.content}`))
      if (result.sources.length === 0) toast.info("No se encontró información relevante")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo consultar el RAG")
    } finally {
      setIsTestingKnowledge(false)
    }
  }

  const handleLogout = async () => {
    if (!window.confirm("¿Cerrar la sesión actual de WhatsApp?")) return
    setIsLoggingOut(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/logout", { method: "POST" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo cerrar la sesión"))
      toast.success("Sesión de WhatsApp cerrada")
      await loadConnection()
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo cerrar la sesión")
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleAcknowledgePhoneChange = async () => {
    if (!status?.phoneChanged || !window.confirm(`¿Confirmar el nuevo número ${status.connectedNumber}?`)) return
    setIsAcknowledgingPhoneChange(true)
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/acknowledge-phone-change", { method: "POST" })
      if (!response.ok) throw new Error(await readMessage(response, "No se pudo confirmar el nuevo número"))
      await loadConnection()
      toast.success("Nuevo número confirmado")
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo confirmar el nuevo número")
    } finally {
      setIsAcknowledgingPhoneChange(false)
    }
  }

  const currentStatus = status ? statusMap[status.status] : null
  const monitoring = agentConfig.monitoring

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Conexiones</h2>
        <p className="mt-1 text-sm text-muted-foreground">Administra WhatsApp, Gemini y la ejecucion del agente de ventas.</p>
      </div>

      <div className="grid w-full grid-cols-2 border-b border-border" role="tablist" aria-label="Secciones de conexiones">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "whatsapp"}
          onClick={() => setActiveTab("whatsapp")}
          className={`relative flex min-h-12 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
            activeTab === "whatsapp"
              ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Image src="/svg/whatsapp.svg" alt="" width={20} height={20} />
          Conexión WhatsApp
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ai"}
          onClick={() => setActiveTab("ai")}
          className={`relative flex min-h-12 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
            activeTab === "ai"
              ? "border-blue-500 text-blue-700 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyIcon className="h-5 w-5" />
          Configuración IA
        </button>
      </div>

      <div className={activeTab === "ai" ? "grid grid-cols-3 rounded-xl border border-border bg-muted/20 p-1" : "hidden"} role="tablist" aria-label="Configuración de inteligencia artificial">
        <button
          type="button"
          role="tab"
          aria-selected={aiTab === "gemini"}
          onClick={() => setAiTab("gemini")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${aiTab === "gemini" ? "bg-background text-blue-700 shadow-sm dark:text-blue-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <KeyIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Conexión </span>Gemini
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aiTab === "rag"}
          onClick={() => setAiTab("rag")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${aiTab === "rag" ? "bg-background text-violet-700 shadow-sm dark:text-violet-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BookOpenIcon className="h-4 w-4" />
          RAG
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aiTab === "agent"}
          onClick={() => setAiTab("agent")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${aiTab === "agent" ? "bg-background text-emerald-700 shadow-sm dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <CpuChipIcon className="h-4 w-4" />
          Agente IA
        </button>
      </div>

      <div className={activeTab === "ai" && aiTab === "agent" ? "block" : "hidden"}>
      <section className="space-y-5 rounded-2xl border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Agente de ventas Kiments</h3>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${agentConfig.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {agentConfig.enabled ? "Activo" : "Detenido"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Los cambios se aplican a las siguientes ejecuciones sin reiniciar el backend.</p>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-xs font-semibold">
            Activar agente
            <Switch checked={agentConfig.enabled} onCheckedChange={(checked) => setAgentConfig((current) => ({ ...current, enabled: checked }))} disabled={isLoadingAgentConfig} />
          </label>
        </div>

        <details className="group overflow-hidden rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-xs font-semibold">Configuración avanzada</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">Agrupación, reserva, confianza, reintentos y límites operativos.</span>
            </span>
            <span className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="grid gap-4 border-t border-border p-4 md:grid-cols-2 xl:grid-cols-3">
            <ConfigNumber label="Agrupación de mensajes" help="Tiempo que espera después del último mensaje." value={agentConfig.messageGroupingMs / 1000} min={0.5} max={60} step={0.5} suffix="seg" onChange={(value) => updateAgentNumber("messageGroupingMs", String(Number(value) * 1000))} />
            <ConfigNumber label="Reserva de pago" help="Fija: el stock queda reservado exactamente cuatro minutos." value={agentConfig.paymentReservationSeconds / 60} min={4} max={4} suffix="min" disabled onChange={() => undefined} />
            <ConfigNumber label="Confianza del comprobante" help="Por debajo de este porcentaje queda observado." value={agentConfig.receiptMinimumConfidence} min={50} max={100} suffix="%" onChange={(value) => updateAgentNumber("receiptMinimumConfidence", value)} />
            <ConfigNumber label="Reintentos de interpretación" value={agentConfig.jobMaxAttempts} min={1} max={10} onChange={(value) => updateAgentNumber("jobMaxAttempts", value)} />
            <ConfigNumber label="Reintentos de envío" value={agentConfig.outboxMaxAttempts} min={1} max={10} onChange={(value) => updateAgentNumber("outboxMaxAttempts", value)} />
            <ConfigNumber label="Mensajes por lote" value={agentConfig.maxMessagesPerBatch} min={1} max={50} onChange={(value) => updateAgentNumber("maxMessagesPerBatch", value)} />
            <ConfigNumber label="Herramientas por ejecución" value={agentConfig.maxToolCallsPerRun} min={1} max={30} onChange={(value) => updateAgentNumber("maxToolCallsPerRun", value)} />
            <ConfigNumber label="Salidas por ejecución" value={agentConfig.maxOutputMessagesPerRun} min={1} max={10} onChange={(value) => updateAgentNumber("maxOutputMessagesPerRun", value)} />
          </div>
        </details>

        <details className="group overflow-hidden rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-xs font-semibold">Personalidad y comportamiento</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">Define el tono y la manera en que IA Kiments conversa con las clientas.</span>
            </span>
            <span className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="space-y-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">Puedes indicar que sea cálida, femenina y cercana. Las reglas de precios, stock, pagos y seguridad no se modifican desde aquí.</p>
            <textarea
              value={agentConfig.agentBehaviorInstructions}
              maxLength={4000}
              rows={8}
              onChange={(event) => setAgentConfig((current) => ({ ...current, agentBehaviorInstructions: event.target.value }))}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Describe cómo debe hablar y atender IA Kiments."
              disabled={isLoadingAgentConfig}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Se aplicará a las siguientes respuestas del agente.</span>
              <span>{agentConfig.agentBehaviorInstructions.length}/4000</span>
            </div>
          </div>
        </details>

        <details className="group overflow-hidden rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-xs font-semibold">Mensaje de bienvenida</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">Se envía una sola vez a los contactos nuevos.</span>
            </span>
            <span className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="space-y-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">No formará parte del contexto de IA Kiments.</p>
            <textarea
              value={agentConfig.welcomeMessage}
              maxLength={4000}
              rows={12}
              onChange={(event) => setAgentConfig((current) => ({ ...current, welcomeMessage: event.target.value }))}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Escribe el aviso que recibirán los nuevos contactos."
              disabled={isLoadingAgentConfig}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Solo se muestra en conversaciones completamente nuevas.</span>
              <span>{agentConfig.welcomeMessage.length}/4000</span>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="text-xs font-semibold">Atencion de asesoras</p>
            <p className="mt-1 text-xs text-muted-foreground">Permite que el agente derive casos de ayuda humana cuando el modulo de asesoras este disponible.</p>
          </div>
          <Switch checked={agentConfig.advisorAttentionEnabled} onCheckedChange={(checked) => setAgentConfig((current) => ({ ...current, advisorAttentionEnabled: checked }))} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setIsShalomModalOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-red-600">
              <Image src="/img/shalom-delivery.png" alt="Shalom" width={40} height={40} className="h-full w-full object-cover" />
            </span>
            <span><span className="block text-sm font-semibold">Agencias Shalom</span><span className="mt-0.5 block text-xs text-muted-foreground">Ver catálogo y sincronización</span></span>
          </button>
          <button
            type="button"
            onClick={() => setIsMonitoringModalOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <ChartBarIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">Monitoreo 24 horas</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${monitoring.health === "HEALTHY" ? "bg-emerald-100 text-emerald-700" : monitoring.health === "ALERT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{monitoring.health === "HEALTHY" ? "Saludable" : monitoring.health === "ALERT" ? "Con errores" : monitoring.health === "WATCH" ? "Observar" : "Sin datos"}</span></span><span className="mt-0.5 block text-xs text-muted-foreground">Ver actividad y errores recientes</span></span>
          </button>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void handleSaveAgentConfig()} disabled={isLoadingAgentConfig || isSavingAgentConfig || !status?.connectionConfigured}>
            {isSavingAgentConfig ? "Aplicando..." : "Guardar configuracion"}
          </Button>
        </div>
      </section>
      </div>

      <div className={activeTab === "ai" && aiTab === "rag" ? "block" : "hidden"}>
      <section className="space-y-5 rounded-2xl border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Base de conocimiento RAG</h3>
            <p className="mt-1 text-xs text-muted-foreground">Información validada para políticas, horarios, ubicación, envíos, cuidados y preguntas frecuentes. No reemplaza las herramientas de precio, stock o ventas.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void loadKnowledge()} disabled={isLoadingKnowledge}>
              <ArrowPathIcon className={`h-4 w-4 ${isLoadingKnowledge ? "animate-spin" : ""}`} />Actualizar
            </Button>
            <Button type="button" size="sm" onClick={() => { setKnowledgeForm(EMPTY_KNOWLEDGE_FORM); setIsKnowledgeModalOpen(true) }} disabled={!status?.connectionConfigured}>
              <PlusIcon className="h-4 w-4" />Nuevo RAG
            </Button>
          </div>
        </div>

        <div className="space-y-3">
            {isLoadingKnowledge ? (
              <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">Cargando conocimientos...</p>
            ) : knowledge.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Todavía no hay conocimientos configurados.</p>
            ) : knowledge.map((article) => (
              <article key={article.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{article.title}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{KNOWLEDGE_CATEGORIES.find((item) => item.value === article.category)?.label ?? article.category}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${article.status === "ACTIVO" ? "bg-emerald-100 text-emerald-700" : article.status === "ERROR" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{article.status === "ACTIVO" ? "Publicado" : article.status === "BORRADOR" ? "Borrador" : article.status === "INDEXANDO" ? "Indexando" : "Error"}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{article.content}</p>
                    {article.lastError && <p className="mt-2 text-xs text-red-600">{article.lastError}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleEditKnowledge(article)}>Editar</Button>
                    <Button type="button" size="sm" variant="outline" className="text-red-600" onClick={() => void handleDeleteKnowledge(article)}><TrashIcon className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <div><p className="text-xs font-semibold">Probar recuperación RAG</p><p className="mt-1 text-xs text-muted-foreground">Comprueba qué contenido encontrará el agente antes de usarlo con clientes.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={knowledgeQuestion} onChange={(event) => setKnowledgeQuestion(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary" placeholder="Ejemplo: ¿Puedo cambiar una prenda?" />
            <Button type="button" variant="outline" onClick={() => void handleTestKnowledge()} disabled={isTestingKnowledge}>{isTestingKnowledge ? "Consultando..." : "Probar RAG"}</Button>
          </div>
          {knowledgeTestResult.map((result, index) => <p key={`${index}-${result}`} className="rounded-lg bg-muted/40 p-3 text-xs text-foreground">{result}</p>)}
        </div>
      </section>
      </div>

      <div className={activeTab === "whatsapp" ? "block" : "hidden"}>
        <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
              <Image src="/svg/whatsapp.svg" alt="WhatsApp" width={30} height={30} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">WhatsApp</h3>
                {currentStatus && <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${currentStatus.className}`}>{currentStatus.label}</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{status?.connectedNumber ? `Número conectado: ${status.connectedNumber}` : currentStatus?.description || "Consultando conexión..."}</p>
              {status?.branch && <p className="mt-1 text-xs text-muted-foreground">Sucursal: {status.branch.nombreSucursal}</p>}
            </div>
          </div>
          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          <Button type="button" className="mt-5 w-full" onClick={() => setIsWhatsappModalOpen(true)}>
            <QrCodeIcon className="h-4 w-4" />Administrar conexión
          </Button>
        </section>

      </div>

      <div className={activeTab === "ai" && aiTab === "gemini" ? "block" : "hidden"}>
        <section className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><KeyIcon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Conexión con Gemini</h3>
              <p className="text-xs text-muted-foreground">Credencial cifrada y prueba de acceso al modelo usado por el agente.</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${aiCredentials?.configured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{aiCredentials?.configured ? "Configurada" : "Pendiente"}</span>
          </div>
          <label className="block space-y-1 text-xs font-medium">{aiCredentials?.source === "DATABASE" ? "Nueva API key" : "API key"}<input type="password" value={apiKeyInput} autoComplete="new-password" onChange={(event) => setApiKeyInput(event.target.value)} placeholder={aiCredentials?.configured ? aiCredentials.maskedKey : "AIza..."} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary" /></label>
          <label className="block space-y-1 text-xs font-medium">Modelo<select value={modelInput} onChange={(event) => setModelInput(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs">{modelInput && !GEMINI_MODELS.some(([value]) => value === modelInput) && <option value={modelInput}>{modelInput} - Configurado</option>}{GEMINI_MODELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="block text-[11px] font-normal text-muted-foreground">Solo se muestran modelos conversacionales compatibles con respuestas estructuradas y herramientas.</span></label>
          {aiCredentials && !aiCredentials.masterKeyConfigured && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Configura AI_SECRETS_MASTER_KEY en el servidor para guardar claves cifradas.</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button type="button" size="sm" onClick={() => void handleSaveCredentials()} disabled={isSavingCredentials || !status?.connectionConfigured || (!apiKeyInput.trim() && modelInput === aiCredentials?.model) || (Boolean(apiKeyInput.trim()) && !aiCredentials?.masterKeyConfigured)}><KeyIcon className="h-4 w-4" />{isSavingCredentials ? "Guardando..." : "Guardar"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void handleTestCredentials()} disabled={isTestingCredentials || !aiCredentials?.configured || !status?.connectionConfigured}><ArrowPathIcon className={`h-4 w-4 ${isTestingCredentials ? "animate-spin" : ""}`} />Probar</Button>
            {aiCredentials?.source === "DATABASE" && <Button type="button" size="sm" variant="outline" onClick={() => void handleDeleteCredentials()} disabled={isDeletingCredentials} className="col-span-2 text-red-600 sm:col-span-1"><TrashIcon className="h-4 w-4" />Eliminar</Button>}
          </div>
          {aiCredentials?.updatedAt && <p className="text-[11px] text-muted-foreground">Última actualización: {new Date(aiCredentials.updatedAt).toLocaleString("es-PE")}{aiCredentials.updatedBy ? ` por ${aiCredentials.updatedBy}` : ""}</p>}
        </section>
      </div>

      <Dialog
        open={isKnowledgeModalOpen}
        onOpenChange={(open) => {
          setIsKnowledgeModalOpen(open)
          if (!open) setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <BookOpenIcon className="h-5 w-5 text-violet-600" />
              {knowledgeForm.id ? "Editar conocimiento RAG" : "Nuevo RAG"}
            </DialogTitle>
            <DialogDescription>Información validada que IA Kiments utilizará para responder consultas informativas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5 text-xs font-medium">Título
              <input value={knowledgeForm.title} maxLength={160} onChange={(event) => setKnowledgeForm((current) => ({ ...current, title: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary" placeholder="Ejemplo: Política de cambios" />
            </label>
            <label className="block space-y-1.5 text-xs font-medium">Categoría
              <select value={knowledgeForm.category} onChange={(event) => setKnowledgeForm((current) => ({ ...current, category: event.target.value as KnowledgeCategory }))} className="h-10 w-full rounded-lg border border-input bg-background px-3">
                {KNOWLEDGE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs font-medium">Contenido
              <textarea value={knowledgeForm.content} maxLength={30000} rows={10} onChange={(event) => setKnowledgeForm((current) => ({ ...current, content: event.target.value }))} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary" placeholder="Escribe la información exacta que IA Kiments puede comunicar." />
            </label>
            <label className="block space-y-1.5 text-xs font-medium">Palabras relacionadas
              <input value={knowledgeForm.keywords} maxLength={500} onChange={(event) => setKnowledgeForm((current) => ({ ...current, keywords: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary" placeholder="cambio, devolución, talla" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-xs font-medium">
              Publicar para que la IA lo utilice
              <Switch checked={knowledgeForm.active} onCheckedChange={(active) => setKnowledgeForm((current) => ({ ...current, active }))} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsKnowledgeModalOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={() => void handleSaveKnowledge()} disabled={isSavingKnowledge || !status?.connectionConfigured}>{isSavingKnowledge ? "Indexando..." : knowledgeForm.id ? "Guardar cambios" : "Crear conocimiento"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isShalomModalOpen} onOpenChange={setIsShalomModalOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Image src="/img/shalom-delivery.png" alt="Shalom" width={28} height={28} className="h-7 w-7 rounded-md object-cover" />
              Agencias Shalom
            </DialogTitle>
            <DialogDescription>Catálogo local que utiliza IA Kiments para interpretar y validar la agencia elegida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => void handleSyncShalom()} disabled={isSyncingShalom || shalomSync?.running}>
                <ArrowPathIcon className={`h-4 w-4 ${(isSyncingShalom || shalomSync?.running) ? "animate-spin" : ""}`} />
                {isSyncingShalom || shalomSync?.running ? "Actualizando..." : "Actualizar agencias"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="Agencias guardadas" value={shalomSync?.totalAgencies ?? 0} />
              <Metric label="Destinos disponibles" value={shalomSync?.availableDestinations ?? 0} />
              <Metric label="Recibidas" value={shalomSync?.received ?? 0} />
              <Metric label="Desactivadas" value={shalomSync?.deactivated ?? 0} danger={(shalomSync?.deactivated ?? 0) > 0} />
            </div>
            <p className="text-xs text-muted-foreground">
              {shalomSync?.lastSuccessfulAt
                ? `Última sincronización correcta: ${new Date(shalomSync.lastSuccessfulAt).toLocaleString("es-PE")}`
                : "Todavía no existe una sincronización correcta."}
            </p>
            {shalomSync?.lastError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{shalomSync.lastError}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMonitoringModalOpen} onOpenChange={setIsMonitoringModalOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-blue-600" />
              Monitoreo de las últimas 24 horas
            </DialogTitle>
            <DialogDescription>Actividad, errores, entregas y duplicados detectados en esta conexión.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${monitoring.health === "HEALTHY" ? "bg-emerald-100 text-emerald-700" : monitoring.health === "ALERT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{monitoring.health === "HEALTHY" ? "Saludable" : monitoring.health === "ALERT" ? "Con errores" : monitoring.health === "WATCH" ? "Observar" : "Sin datos"}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadAgentConfig()} disabled={isLoadingAgentConfig}>
                <ArrowPathIcon className={`h-4 w-4 ${isLoadingAgentConfig ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="Conversaciones" value={monitoring.sessions} />
              <Metric label="Respuestas enviadas" value={monitoring.sentOutputs} />
              <Metric label="Errores" value={monitoring.failedJobs + monitoring.failedTools + monitoring.failedOutputs} danger={monitoring.failedJobs + monitoring.failedTools + monitoring.failedOutputs > 0} />
              <Metric label="Comprobantes duplicados" value={monitoring.duplicateReceipts} danger={monitoring.duplicateReceipts > 0} />
              <Metric label="Respuestas obsoletas evitadas" value={monitoring.suppressedResponses} />
              <Metric label="Envíos pendientes" value={monitoring.pendingOutputs} />
              <Metric label="Jobs completados" value={monitoring.completedJobs} />
              <Metric label="Ventas automáticas" value={monitoring.automaticSales} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWhatsappModalOpen} onOpenChange={setIsWhatsappModalOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-border px-5 pb-3 pt-5 text-left">
            <DialogTitle>Conexión de WhatsApp</DialogTitle>
            <DialogDescription>Vincula la sucursal y escanea el QR cuando sea necesario.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {isLoading ? <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Consultando estado...</p> : (
              <>
                <div className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div><p className="text-sm font-semibold">{currentStatus?.label || "Sin conexión"}</p><p className="mt-1 text-xs text-muted-foreground">{currentStatus?.description}</p></div>
                  <Button type="button" size="sm" variant="outline" onClick={() => void loadConnection()} disabled={isRefreshing}><ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />Actualizar</Button>
                </div>
                {status?.phoneChanged && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"><p className="font-semibold">Se detectó un número distinto: {status.connectedNumber}</p><Button type="button" size="sm" className="mt-3" onClick={() => void handleAcknowledgePhoneChange()} disabled={isAcknowledgingPhoneChange}>Confirmar número</Button></div>}
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <label className="text-xs font-medium">Sucursal de venta<select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} disabled={isLoadingBranches} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-xs"><option value="">Selecciona una sucursal</option>{branches.map((branch) => <option key={branch.idSucursal} value={branch.idSucursal}>{branch.nombreSucursal}</option>)}</select></label>
                  <Button type="button" size="sm" onClick={() => void handleSaveBranch()} disabled={isSavingBranch || !selectedBranchId}>{isSavingBranch ? "Guardando..." : "Guardar sucursal"}</Button>
                </div>
                {qrDataUrl && <div className="flex flex-col items-center rounded-xl border border-border p-5"><Image src={qrDataUrl} alt="Código QR de WhatsApp" width={260} height={260} unoptimized /><p className="mt-3 text-center text-xs text-muted-foreground">Escanea este código desde Dispositivos vinculados en WhatsApp.</p></div>}
                {status?.status === "CONNECTED" && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircleIcon className="h-5 w-5" />WhatsApp conectado{status.connectedNumber ? ` como ${status.connectedNumber}` : ""}.</div>}
                {status?.lastError && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700"><ExclamationTriangleIcon className="h-5 w-5 shrink-0" />{status.lastError}</div>}
                {status?.status === "CONNECTED" && <Button type="button" variant="outline" className="w-full text-red-600" onClick={() => void handleLogout()} disabled={isLoggingOut}><ArrowRightOnRectangleIcon className="h-4 w-4" />{isLoggingOut ? "Cerrando..." : "Cerrar sesión de WhatsApp"}</Button>}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConfigNumber({ label, help, value, min, max, step = 1, suffix, disabled, onChange }: {
  label: string
  help?: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1.5 text-xs font-medium">
      <span>{label}</span>
      <div className="flex h-10 overflow-hidden rounded-lg border border-input bg-background">
        <input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 outline-none disabled:cursor-not-allowed disabled:bg-muted/40" />
        {suffix && <span className="flex items-center border-l border-input bg-muted/40 px-3 text-muted-foreground">{suffix}</span>}
      </div>
      {help && <span className="block font-normal text-muted-foreground">{help}</span>}
    </label>
  )
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className={`rounded-lg border p-3 ${danger ? "border-red-200 bg-red-50" : "border-border bg-muted/20"}`}><p className={`text-lg font-bold ${danger ? "text-red-700" : "text-foreground"}`}>{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
}
