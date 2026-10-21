"use client"

import { cn } from "@/lib/utils"

export function ChatConversationSkeletons({ label = "Cargando chats" }: { label?: string }) {
  return (
    <div className="space-y-3 px-4 py-5" aria-label={label}>
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-3 py-2">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-muted" />
            <div className="h-2.5 w-full rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChatMessageSkeletons({ compact = false }: { compact?: boolean }) {
  const count = compact ? 2 : 6
  return (
    <div className={cn("flex flex-col gap-3", compact ? "py-2" : "py-4")} aria-label="Cargando mensajes">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={cn(
            "h-14 animate-pulse rounded-xl bg-background/70 shadow-sm",
            index % 2 === 0 ? "mr-auto w-[58%]" : "ml-auto w-[48%]",
          )}
        />
      ))}
    </div>
  )
}
