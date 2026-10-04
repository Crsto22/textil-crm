import { memo, useMemo } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"

interface PaginationResponsiveProps {
  totalElements: number
  totalPages: number
  page: number
  onPageChange: (value: number | ((prev: number) => number)) => void
  itemLabel?: string
}

function buildPageRange(current: number, total: number): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i)
  }

  const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [0]

  if (current <= 2) {
    pages.push(1, 2, 3, "ellipsis-end", total - 1)
  } else if (current >= total - 3) {
    pages.push("ellipsis-start", total - 4, total - 3, total - 2, total - 1)
  } else {
    pages.push("ellipsis-start", current - 1, current, current + 1, "ellipsis-end", total - 1)
  }

  return pages
}

function PaginationResponsiveComponent({
  totalElements,
  totalPages,
  page,
  onPageChange,
  itemLabel = "resultados",
}: PaginationResponsiveProps) {
  const pageRange = useMemo(
    () => buildPageRange(page, totalPages),
    [page, totalPages]
  )

  if (totalPages <= 1 && totalElements === 0) {
    return null
  }

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        {totalElements} {itemLabel}
        {totalPages > 1 && ` — Pagina ${page + 1} de ${totalPages}`}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange((prev) => Math.max(0, prev - 1))}
            disabled={page === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          {pageRange.map((item) => {
            if (item === "ellipsis-start" || item === "ellipsis-end") {
              return (
                <span
                  key={item}
                  className="inline-flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
                >
                  ...
                </span>
              )
            }

            return (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                  item === page
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {item + 1}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => onPageChange((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={page >= totalPages - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export const PaginationResponsive = memo(PaginationResponsiveComponent)
