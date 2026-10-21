function isSameCalendarDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function calendarDayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

export function conversationDayKey(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatConversationDayLabel(
  value: string | null | undefined,
  now = new Date(),
) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const daysAgo = Math.round(
    (calendarDayNumber(now) - calendarDayNumber(date)) / 86_400_000,
  )

  if (daysAgo === 0) return "Hoy"
  if (daysAgo === 1) return "Ayer"

  if (daysAgo >= 2 && daysAgo <= 6) {
    const weekday = new Intl.DateTimeFormat("es-PE", { weekday: "long" }).format(date)
    return weekday.charAt(0).toUpperCase() + weekday.slice(1)
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function formatConversationListDate(
  value: string | null | undefined,
  now = new Date(),
) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  if (isSameCalendarDay(date, now)) {
    return new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameCalendarDay(date, yesterday)) return "Ayer"

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${date.getFullYear()}`
}
