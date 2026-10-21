"use client"

import { useEffect, useState } from "react"
import { PhotoIcon } from "@heroicons/react/24/outline"

import { authFetch } from "@/lib/auth/auth-fetch"
import { cn } from "@/lib/utils"

type AuthenticatedImageThumbnailProps = {
  src?: string | null
  alt: string
  className?: string
}

export function AuthenticatedImageThumbnail({ src, alt, className }: AuthenticatedImageThumbnailProps) {
  const [loadedImage, setLoadedImage] = useState<{
    source: string
    url: string | null
    failed: boolean
  } | null>(null)
  const isDirectSource = Boolean(src?.startsWith("blob:") || src?.startsWith("data:"))
  const resolvedUrl = isDirectSource ? src ?? null : loadedImage?.source === src ? loadedImage?.url ?? null : null
  const failed = Boolean(!isDirectSource && loadedImage?.source === src && loadedImage?.failed)
  const loading = Boolean(src) && !isDirectSource && loadedImage?.source !== src

  useEffect(() => {
    if (!src || src.startsWith("blob:") || src.startsWith("data:")) return

    const controller = new AbortController()
    let objectUrl: string | null = null

    void authFetch(src, { cache: "force-cache", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la imagen")
        return response.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setLoadedImage({ source: src, url: objectUrl, failed: false })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setLoadedImage({ source: src, url: null, failed: true })
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  return (
    <span
      className={cn("relative block overflow-hidden bg-muted", className)}
      role="img"
      aria-label={alt}
      aria-busy={loading}
    >
      {resolvedUrl && (
        <span
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${resolvedUrl}")` }}
        />
      )}
      {!resolvedUrl && (
        <span className={cn(
          "absolute inset-0 flex items-center justify-center text-muted-foreground/50",
          loading && "animate-pulse",
        )}>
          <PhotoIcon className="h-6 w-6" />
        </span>
      )}
      {failed && <span className="sr-only">No se pudo cargar la imagen</span>}
    </span>
  )
}
