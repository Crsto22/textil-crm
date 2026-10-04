"use client"

import { KimentsCrmLogo } from "@/components/KimentsCrmLogo"
import { cn } from "@/lib/utils"

interface LoaderOverlayProps {
  className?: string
}

export function LoaderOverlay({
  className,
}: LoaderOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[250] flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-black/60",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-6 px-10 py-9">
        <KimentsCrmLogo size="lg" />
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400 dark:border-t-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
