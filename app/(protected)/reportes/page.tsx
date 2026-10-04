"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  InboxIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authFetch } from "@/lib/auth/auth-fetch"

type CrmReportFilter = "HOY" | "ULT_7_DIAS" | "ULT_14_DIAS" | "ULT_30_DIAS"

type CrmReportKpis = {
  chatsTotales: number
  chatsResueltos: number
  chatsEspera: number
  chatsAtendidos: number
  mensajesRecibidos: number
  mensajesEnviados: number
  clientesVinculados: number
  clientesNuevos: number
}

type CrmReportSeriesPoint = {
  fecha: string
  etiqueta: string
  granularidad: string
  valor: number
}

type CrmReportCategoryItem = {
  label: string
  value: number
}

type CrmReportUserRankingItem = {
  idUsuario: number
  usuario: string
  chatsAtendidos: number
  chatsResueltos: number
}

type CrmReportResponse = {
  filtro: string
  desde: string
  hasta: string
  kpis: CrmReportKpis
  mensajesPorFecha: CrmReportSeriesPoint[]
  chatsResueltosPorFecha: CrmReportSeriesPoint[]
  clientesNuevosPorFecha: CrmReportSeriesPoint[]
  conversacionesPorEstado: CrmReportCategoryItem[]
  mensajesPorTipo: CrmReportCategoryItem[]
  mensajesPorDireccion: CrmReportCategoryItem[]
  usuariosRanking: CrmReportUserRankingItem[]
}

const FILTER_OPTIONS: { key: CrmReportFilter; label: string }[] = [
  { key: "HOY", label: "Hoy" },
  { key: "ULT_7_DIAS", label: "Ultimos 7 dias" },
  { key: "ULT_14_DIAS", label: "Ultimos 14 dias" },
  { key: "ULT_30_DIAS", label: "Ultimos 30 dias" },
]

const CHART_COLORS = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#ef4444", "#06b6d4"]

function todayValue() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeSeries(value: unknown): CrmReportSeriesPoint[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const payload = item as Partial<CrmReportSeriesPoint>
    return {
      fecha: String(payload.fecha ?? ""),
      etiqueta: String(payload.etiqueta ?? payload.fecha ?? ""),
      granularidad: String(payload.granularidad ?? "DIA"),
      valor: toNumber(payload.valor),
    }
  })
}

function normalizeCategories(value: unknown): CrmReportCategoryItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const payload = item as Partial<CrmReportCategoryItem>
    return {
      label: String(payload.label ?? "Sin dato"),
      value: toNumber(payload.value),
    }
  })
}

function normalizeRanking(value: unknown): CrmReportUserRankingItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const payload = item as Partial<CrmReportUserRankingItem>
    return {
      idUsuario: toNumber(payload.idUsuario),
      usuario: String(payload.usuario ?? "Usuario"),
      chatsAtendidos: toNumber(payload.chatsAtendidos),
      chatsResueltos: toNumber(payload.chatsResueltos),
    }
  })
}

function normalizeReport(payload: unknown): CrmReportResponse {
  const data = payload as Partial<CrmReportResponse>
  const kpis = (data.kpis ?? {}) as Partial<CrmReportKpis>

  return {
    filtro: String(data.filtro ?? "HOY"),
    desde: String(data.desde ?? ""),
    hasta: String(data.hasta ?? ""),
    kpis: {
      chatsTotales: toNumber(kpis.chatsTotales),
      chatsResueltos: toNumber(kpis.chatsResueltos),
      chatsEspera: toNumber(kpis.chatsEspera),
      chatsAtendidos: toNumber(kpis.chatsAtendidos),
      mensajesRecibidos: toNumber(kpis.mensajesRecibidos),
      mensajesEnviados: toNumber(kpis.mensajesEnviados),
      clientesVinculados: toNumber(kpis.clientesVinculados),
      clientesNuevos: toNumber(kpis.clientesNuevos),
    },
    mensajesPorFecha: normalizeSeries(data.mensajesPorFecha),
    chatsResueltosPorFecha: normalizeSeries(data.chatsResueltosPorFecha),
    clientesNuevosPorFecha: normalizeSeries(data.clientesNuevosPorFecha),
    conversacionesPorEstado: normalizeCategories(data.conversacionesPorEstado),
    mensajesPorTipo: normalizeCategories(data.mensajesPorTipo),
    mensajesPorDireccion: normalizeCategories(data.mensajesPorDireccion),
    usuariosRanking: normalizeRanking(data.usuariosRanking),
  }
}

async function readApiMessage(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.message === "string" ? data.message : fallback
  } catch {
    return fallback
  }
}

function buildQuery(activeFilter: CrmReportFilter, useCustomRange: boolean, desde: string, hasta: string) {
  const params = new URLSearchParams()
  if (useCustomRange) {
    params.set("desde", desde)
    params.set("hasta", hasta)
  } else {
    params.set("filtro", activeFilter)
  }
  return params.toString()
}

function labelFor(value: string) {
  const labels: Record<string, string> = {
    ESPERA: "En espera",
    ATENDIDO: "Atendidos",
    RESUELTO: "Resueltos",
    INCOMING: "Recibidos",
    OUTGOING: "Enviados",
    SYSTEM: "Sistema",
    TEXT: "Texto",
    IMAGE: "Imagen",
    VIDEO: "Video",
    AUDIO: "Audio",
    DOCUMENT: "Archivo",
  }
  return labels[value] ?? value
}

function formatTooltipValue(value: unknown) {
  return Number(value).toLocaleString("es-PE")
}

function MetricCard({
  title,
  value,
  icon: Icon,
  iconColor,
}: {
  title: string
  value: number
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  iconColor: string
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">{value.toLocaleString("es-PE")}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </span>
      </div>
    </article>
  )
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:p-5">
      <div className="mb-4 space-y-1">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white sm:text-lg">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{description}</p>
      </div>
      {children}
    </section>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
      {message}
    </div>
  )
}

function SeriesChart({ data, color = "#2563eb" }: { data: CrmReportSeriesPoint[]; color?: string }) {
  if (!data.some((item) => item.valor > 0)) {
    return <EmptyChart message="No hay datos suficientes para construir la tendencia." />
  }

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 10, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id={`area-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.32} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.28)" vertical={false} />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip formatter={formatTooltipValue} labelClassName="text-slate-700" />
          <Area
            type="monotone"
            dataKey="valor"
            stroke={color}
            fill={`url(#area-${color.replace("#", "")})`}
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function DonutChart({ data, emptyMessage }: { data: CrmReportCategoryItem[]; emptyMessage: string }) {
  const chartData = data.filter((item) => item.value > 0).map((item) => ({ ...item, label: labelFor(item.label) }))
  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) {
    return <EmptyChart message={emptyMessage} />
  }

  return (
    <div className="grid min-h-[260px] gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
      <div className="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={54} outerRadius={82} paddingAngle={2}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={formatTooltipValue} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {chartData.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/70">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span className="truncate text-slate-600 dark:text-slate-300">{item.label}</span>
            </span>
            <span className="font-semibold text-slate-950 dark:text-white">{item.value.toLocaleString("es-PE")}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HorizontalBars({
  data,
  dataKey,
  nameKey,
  emptyMessage,
}: {
  data: Array<Record<string, string | number>>
  dataKey: string
  nameKey: string
  emptyMessage: string
}) {
  if (!data.some((item) => Number(item[dataKey]) > 0)) {
    return <EmptyChart message={emptyMessage} />
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.28)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey={nameKey}
            width={118}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip formatter={formatTooltipValue} />
          <Bar dataKey={dataKey} fill="#2563eb" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  )
}

export default function ReportesPage() {
  const [activeFilter, setActiveFilter] = useState<CrmReportFilter>("HOY")
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [fechaDesde, setFechaDesde] = useState(todayValue())
  const [fechaHasta, setFechaHasta] = useState(todayValue())
  const [data, setData] = useState<CrmReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReports = useCallback(async (showToast = false) => {
    if (useCustomRange && fechaDesde > fechaHasta) {
      setError("La fecha desde no puede ser mayor a la fecha hasta")
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const query = buildQuery(activeFilter, useCustomRange, fechaDesde, fechaHasta)
      const response = await authFetch(`/api/crm/whatsapp/reports?${query}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudieron cargar los reportes"))
      }
      const payload = await response.json()
      setData(normalizeReport(payload))
      if (showToast) {
        toast.success("Reportes actualizados")
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudieron cargar los reportes"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [activeFilter, fechaDesde, fechaHasta, useCustomRange])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadReports])

  const userRankingData = useMemo(
    () =>
      (data?.usuariosRanking ?? []).map((item) => ({
        usuario: item.usuario,
        resueltos: item.chatsResueltos,
        atendidos: item.chatsAtendidos,
      })),
    [data?.usuariosRanking],
  )

  if (loading && !data) {
    return <ReportSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setUseCustomRange(false)
                setActiveFilter(option.key)
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                !useCustomRange && activeFilter === option.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[220px_repeat(2,160px)_auto] sm:items-center">
            <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={useCustomRange}
                onChange={(event) => setUseCustomRange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Usar rango
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(event) => setFechaDesde(event.target.value)}
              disabled={!useCustomRange}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={(event) => setFechaHasta(event.target.value)}
              disabled={!useCustomRange}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <Button variant="outline" className="h-11 rounded-xl" disabled={loading} onClick={() => void loadReports(true)}>
              <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
        </div>
      </div>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button variant="outline" className="rounded-xl" onClick={() => void loadReports()}>
              Reintentar
            </Button>
          </div>
        </section>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard title="Chats totales" value={data.kpis.chatsTotales} icon={ChatBubbleLeftRightIcon} iconColor="text-blue-600" />
            <MetricCard title="Chats resueltos" value={data.kpis.chatsResueltos} icon={CheckCircleIcon} iconColor="text-emerald-600" />
            <MetricCard title="En espera" value={data.kpis.chatsEspera} icon={ClockIcon} iconColor="text-amber-500" />
            <MetricCard title="Atendidos" value={data.kpis.chatsAtendidos} icon={InboxIcon} iconColor="text-violet-600" />
            <MetricCard title="Mensajes recibidos" value={data.kpis.mensajesRecibidos} icon={InboxIcon} iconColor="text-cyan-600" />
            <MetricCard title="Mensajes enviados" value={data.kpis.mensajesEnviados} icon={PaperAirplaneIcon} iconColor="text-sky-600" />
            <MetricCard title="Clientes vinculados" value={data.kpis.clientesVinculados} icon={UserGroupIcon} iconColor="text-fuchsia-600" />
            <MetricCard title="Clientes nuevos" value={data.kpis.clientesNuevos} icon={UserPlusIcon} iconColor="text-orange-600" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <ChartCard title="Tendencia de mensajes" description="Volumen de mensajes recibidos y enviados dentro del periodo.">
              <SeriesChart data={data.mensajesPorFecha} />
            </ChartCard>

            <ChartCard title="Conversaciones por estado" description="Distribucion actual de chats creados en el periodo.">
              <DonutChart data={data.conversacionesPorEstado} emptyMessage="No hay conversaciones para agrupar." />
            </ChartCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Chats resueltos" description="Conversaciones cerradas por hora o fecha.">
              <SeriesChart data={data.chatsResueltosPorFecha} color="#10b981" />
            </ChartCard>

            <ChartCard title="Clientes nuevos vinculados" description="Clientes creados y vinculados al CRM WhatsApp.">
              <SeriesChart data={data.clientesNuevosPorFecha} color="#f97316" />
            </ChartCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Mensajes por tipo" description="Texto, imagenes, audio, video y documentos.">
              <DonutChart data={data.mensajesPorTipo} emptyMessage="No hay mensajes para agrupar por tipo." />
            </ChartCard>

            <ChartCard title="Ranking de usuarios CRM" description="Usuarios con mayor cantidad de chats resueltos.">
              <HorizontalBars
                data={userRankingData}
                dataKey="resueltos"
                nameKey="usuario"
                emptyMessage="No hay actividad de usuarios para mostrar."
              />
            </ChartCard>
          </div>
        </>
      ) : null}
    </div>
  )
}
