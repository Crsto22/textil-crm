export interface OfertaTemporal {
  precio?: number | null
  precioOferta?: number | null
  ofertaInicio?: string | null
  ofertaFin?: string | null
}

export type EstadoVigenciaOferta =
  | "sin-oferta"
  | "indefinida"
  | "programada"
  | "activa"
  | "vencida"
  | "invalida"

const LOCAL_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function parseFechaHoraLocal(value: string | null | undefined): Date | null {
  const normalizedValue = normalizarFechaHoraLocal(value)
  if (normalizedValue === "") return null

  const regexMatch = normalizedValue.match(LOCAL_DATE_TIME_REGEX)
  if (regexMatch) {
    const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw] = regexMatch
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    const day = Number(dayRaw)
    const hour = Number(hourRaw)
    const minute = Number(minuteRaw)
    const second = Number(secondRaw ?? "0")

    const parsed = new Date(year, month - 1, day, hour, minute, second, 0)
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day ||
      parsed.getHours() !== hour ||
      parsed.getMinutes() !== minute ||
      parsed.getSeconds() !== second
    ) {
      return null
    }

    return parsed
  }

  const parsed = new Date(normalizedValue)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function normalizarFechaHoraLocal(value: string | null | undefined): string {
  const trimmedValue = String(value ?? "").trim()
  if (trimmedValue === "") return ""

  return trimmedValue.replace(" ", "T")
}

export function convertirFechaHoraLocalParaInput(
  value: string | null | undefined
): string {
  const normalizedValue = normalizarFechaHoraLocal(value)
  if (normalizedValue === "") return ""

  const regexMatch = normalizedValue.match(LOCAL_DATE_TIME_REGEX)
  if (!regexMatch) return normalizedValue

  const [, year, month, day, hour, minute, second] = regexMatch
  return second
    ? `${year}-${month}-${day}T${hour}:${minute}:${second}`
    : `${year}-${month}-${day}T${hour}:${minute}`
}

export function convertirFechaHoraLocalParaBackend(
  value: string | null | undefined
): string | null {
  const normalizedValue = normalizarFechaHoraLocal(value)
  if (normalizedValue === "") return null

  const regexMatch = normalizedValue.match(LOCAL_DATE_TIME_REGEX)
  if (regexMatch) {
    const [, year, month, day, hour, minute, second] = regexMatch
    return `${year}-${month}-${day}T${hour}:${minute}:${second ?? "00"}`
  }

  const parsed = new Date(normalizedValue)
  if (Number.isNaN(parsed.getTime())) return null

  return [
    parsed.getFullYear(),
    pad2(parsed.getMonth() + 1),
    pad2(parsed.getDate()),
  ].join("-") +
    `T${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}:${pad2(parsed.getSeconds())}`
}

export function tienePrecioOfertaValido({
  precio,
  precioOferta,
}: OfertaTemporal): boolean {
  return (
    typeof precio === "number" &&
    typeof precioOferta === "number" &&
    precioOferta > 0 &&
    precioOferta < precio
  )
}

export function tieneRangoOfertaCompleto({
  ofertaInicio,
  ofertaFin,
}: Pick<OfertaTemporal, "ofertaInicio" | "ofertaFin">): boolean {
  return (
    normalizarFechaHoraLocal(ofertaInicio) !== "" &&
    normalizarFechaHoraLocal(ofertaFin) !== ""
  )
}

export function obtenerEstadoVigenciaOferta(
  oferta: OfertaTemporal,
  ahora: Date = new Date()
): EstadoVigenciaOferta {
  if (!tienePrecioOfertaValido(oferta)) {
    return "sin-oferta"
  }

  const hasStart = normalizarFechaHoraLocal(oferta.ofertaInicio) !== ""
  const hasEnd = normalizarFechaHoraLocal(oferta.ofertaFin) !== ""

  if (!hasStart && !hasEnd) {
    return "indefinida"
  }

  if (!hasStart || !hasEnd) {
    return "invalida"
  }

  const fechaInicio = parseFechaHoraLocal(oferta.ofertaInicio)
  const fechaFin = parseFechaHoraLocal(oferta.ofertaFin)

  if (!fechaInicio || !fechaFin || fechaFin <= fechaInicio) {
    return "invalida"
  }

  if (ahora < fechaInicio) {
    return "programada"
  }

  if (ahora > fechaFin) {
    return "vencida"
  }

  return "activa"
}

export function ofertaEstaVigente(
  oferta: OfertaTemporal,
  ahora: Date = new Date()
): boolean {
  const estado = obtenerEstadoVigenciaOferta(oferta, ahora)
  return estado === "indefinida" || estado === "activa"
}

export function obtenerPrecioAplicadoOferta(
  oferta: OfertaTemporal,
  ahora: Date = new Date()
): number {
  if (ofertaEstaVigente(oferta, ahora) && typeof oferta.precioOferta === "number") {
    return oferta.precioOferta
  }

  if (typeof oferta.precio === "number") {
    return oferta.precio
  }

  return 0
}

export function formatearFechaHoraOferta(value: string | null | undefined): string {
  const parsed = parseFechaHoraLocal(value)
  if (!parsed) return "-"

  return parsed.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatearRangoOferta(
  ofertaInicio: string | null | undefined,
  ofertaFin: string | null | undefined
): string {
  const start = normalizarFechaHoraLocal(ofertaInicio)
  const end = normalizarFechaHoraLocal(ofertaFin)

  if (start === "" && end === "") {
    return "Sin fecha de vencimiento"
  }

  if (start === "" || end === "") {
    return "Vigencia incompleta"
  }

  return `${formatearFechaHoraOferta(start)} - ${formatearFechaHoraOferta(end)}`
}

function formatearCantidadTiempo(
  value: number,
  singular: string,
  plural: string
): string {
  return `${value} ${value === 1 ? singular : plural}`
}

export function obtenerMilisegundosRestantesOferta(
  oferta: OfertaTemporal,
  ahora: Date = new Date()
): number | null {
  if (obtenerEstadoVigenciaOferta(oferta, ahora) !== "activa") {
    return null
  }

  const fechaFin = parseFechaHoraLocal(oferta.ofertaFin)
  if (!fechaFin) {
    return null
  }

  return Math.max(0, fechaFin.getTime() - ahora.getTime())
}

export function formatearTiempoRestanteOferta(miliseconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(miliseconds / 60000))
  const minutesPerDay = 24 * 60
  const days = Math.floor(totalMinutes / minutesPerDay)
  const hours = Math.floor((totalMinutes % minutesPerDay) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    if (hours > 0) {
      return `${formatearCantidadTiempo(days, "dia", "dias")} ${formatearCantidadTiempo(hours, "hora", "horas")}`
    }
    return formatearCantidadTiempo(days, "dia", "dias")
  }

  if (hours > 0) {
    if (minutes > 0) {
      return `${formatearCantidadTiempo(hours, "hora", "horas")} ${minutes} min`
    }
    return formatearCantidadTiempo(hours, "hora", "horas")
  }

  return `${totalMinutes} min`
}

export function formatearTiempoRestanteOfertaResumido(miliseconds: number): string {
  const totalHours = Math.max(1, Math.ceil(miliseconds / 3600000))

  if (totalHours >= 24) {
    return formatearCantidadTiempo(Math.ceil(totalHours / 24), "dia", "dias")
  }

  return formatearCantidadTiempo(totalHours, "hora", "horas")
}

export function obtenerTextoExpiracionOferta(
  oferta: OfertaTemporal,
  ahora: Date = new Date()
): string | null {
  const estado = obtenerEstadoVigenciaOferta(oferta, ahora)

  if (estado === "indefinida") {
    return "Promocion sin fecha de vencimiento"
  }

  if (estado !== "activa") {
    return null
  }

  const miliseconds = obtenerMilisegundosRestantesOferta(oferta, ahora)
  if (miliseconds === null) {
    return "Promocion activa"
  }

  return `Se expira en ${formatearTiempoRestanteOferta(miliseconds)}`
}

export type CountdownOferta =
  | { tipo: "vence"; texto: string }
  | { tipo: "inicia"; texto: string }

export function obtenerCountdownOferta(
  oferta: OfertaTemporal,
  ahora: Date = new Date()
): CountdownOferta | null {
  const estado = obtenerEstadoVigenciaOferta(oferta, ahora)

  if (estado === "activa") {
    const ms = obtenerMilisegundosRestantesOferta(oferta, ahora)
    if (ms === null) return null
    return { tipo: "vence", texto: `Vence en ${formatearTiempoRestanteOferta(ms)}` }
  }

  if (estado === "programada") {
    const fechaInicio = parseFechaHoraLocal(oferta.ofertaInicio)
    if (!fechaInicio) return null
    const ms = Math.max(0, fechaInicio.getTime() - ahora.getTime())
    return { tipo: "inicia", texto: `Inicia en ${formatearTiempoRestanteOferta(ms)}` }
  }

  return null
}

export function obtenerCountdownOfertaResumido(
  oferta: OfertaTemporal,
  ahora: Date = new Date()
): CountdownOferta | null {
  const estado = obtenerEstadoVigenciaOferta(oferta, ahora)

  if (estado === "activa") {
    const ms = obtenerMilisegundosRestantesOferta(oferta, ahora)
    if (ms === null) return null
    return { tipo: "vence", texto: `Vence en ${formatearTiempoRestanteOfertaResumido(ms)}` }
  }

  if (estado === "programada") {
    const fechaInicio = parseFechaHoraLocal(oferta.ofertaInicio)
    if (!fechaInicio) return null
    const ms = Math.max(0, fechaInicio.getTime() - ahora.getTime())
    return { tipo: "inicia", texto: `Inicia en ${formatearTiempoRestanteOfertaResumido(ms)}` }
  }

  return null
}
