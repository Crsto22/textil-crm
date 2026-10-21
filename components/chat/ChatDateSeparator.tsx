export function ChatDateSeparator({ label }: { label: string }) {
  if (!label) return null

  return (
    <div className="flex justify-center py-1">
      <span className="rounded-md border border-border bg-background/90 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-sm">
        {label}
      </span>
    </div>
  )
}
