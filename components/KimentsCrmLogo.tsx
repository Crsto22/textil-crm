"use client"

import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/solid"
import { KimentsLogo } from "@/components/KimentsLogo"
import { cn } from "@/lib/utils"

interface KimentsCrmLogoProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const badgeSizeClasses = {
  sm: "-right-5 -top-3 h-6 w-6",
  md: "-right-6 -top-3.5 h-8 w-8",
  lg: "-right-7 -top-4 h-9 w-9",
}

const iconSizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
}

export function KimentsCrmLogo({ size = "md", className }: KimentsCrmLogoProps) {
  return (
    <div className={cn("relative", className)}>
      <KimentsLogo size={size} />
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:text-emerald-400 dark:ring-white/10",
          badgeSizeClasses[size],
        )}
      >
        <ChatBubbleLeftRightIcon className={iconSizeClasses[size]} aria-hidden="true" />
      </span>
    </div>
  )
}
