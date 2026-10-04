"use client"

import { cn } from "@/lib/utils"

interface KimentsLogoProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: {
    main: "font-[family-name:var(--font-kiments)] text-sm tracking-[0.15em]",
    sub: "mt-1 text-[7px] font-light uppercase tracking-[0.22em]",
  },
  md: {
    main: "font-[family-name:var(--font-kiments)] text-xl tracking-[0.16em]",
    sub: "mt-1.5 text-[9px] font-light uppercase tracking-[0.24em]",
  },
  lg: {
    main: "font-[family-name:var(--font-kiments)] text-4xl tracking-[0.16em]",
    sub: "mt-2 text-[10px] font-light uppercase tracking-[0.24em]",
  },
}

export function KimentsLogo({ size = "md", className }: KimentsLogoProps) {
  const s = sizeClasses[size]

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-black dark:text-white",
        className,
      )}
    >
      <p className={s.main}>KIMENTS</p>
      <p className={s.sub}>TIENDA DE ROPA</p>
    </div>
  )
}
