"use client"

import { useState } from "react"
import { PencilSquareIcon, TagIcon } from "@heroicons/react/24/outline"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export type PriceType = "normal" | "oferta" | "mayor" | "editado"

export interface PriceOption {
  type: PriceType
  label: string
  value: number
}

interface PriceSelectorDropdownProps {
  options: PriceOption[]
  selectedType?: PriceType | null
  onSelect: (priceType: PriceType) => void
  onEditPrice?: () => void
  triggerLabel?: string
  align?: "start" | "center" | "end"
  disabled?: boolean
}

function formatMoney(value: number) {
  return `S/${value.toFixed(2)}`
}

function getOptionAccentClass(type: PriceType) {
  switch (type) {
    case "oferta":
      return "bg-emerald-500"
    case "mayor":
      return "bg-amber-500"
    case "editado":
      return "bg-violet-500"
    default:
      return "bg-slate-400"
  }
}

function PriceOptionsList({
  options,
  selectedType,
  onSelect,
  onEditPrice,
}: {
  options: PriceOption[]
  selectedType?: PriceType | null
  onSelect: (priceType: PriceType) => void
  onEditPrice?: () => void
}) {
  return (
    <div className="space-y-1">
      {options.map((option) => {
        const active = option.type === selectedType
        return (
          <button
            key={option.type}
            type="button"
            onClick={() => onSelect(option.type)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition",
              active
                ? "bg-slate-100 dark:bg-slate-800/80"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
            )}
          >
            <span
              className={cn(
                "mt-1.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
                getOptionAccentClass(option.type),
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {option.label}
              </p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(option.value)}
              </p>
            </div>
            {active && (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
            )}
          </button>
        )
      })}

      {onEditPrice && (
        <>
          {options.length > 0 && (
            <div className="mx-2 my-1 border-t border-slate-100 dark:border-slate-700/60" />
          )}
          <button
            type="button"
            onClick={onEditPrice}
            className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-blue-400"
          >
            <PencilSquareIcon className="h-4 w-4 shrink-0" />
            Editar precio manualmente
          </button>
        </>
      )}
    </div>
  )
}

export function PriceSelectorDropdown({
  options,
  selectedType,
  onSelect,
  onEditPrice,
  triggerLabel = "Cambiar precio",
  align = "end",
  disabled = false,
}: PriceSelectorDropdownProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleSelect = (priceType: PriceType) => {
    onSelect(priceType)
    setSheetOpen(false)
  }

  const handleEditPrice = onEditPrice
    ? () => {
        setSheetOpen(false)
        onEditPrice()
      }
    : undefined

  const triggerClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"

  return (
    <>
      {/* ─── MOBILE: Sheet ─── */}
      <div className="sm:hidden">
        <button
          type="button"
          aria-label={triggerLabel}
          title={triggerLabel}
          disabled={disabled}
          onClick={() => setSheetOpen(true)}
          className={triggerClass}
        >
          <TagIcon className="h-3.5 w-3.5" />
        </button>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetHeader className="mb-3">
              <SheetTitle className="text-sm">Opciones de precio</SheetTitle>
            </SheetHeader>
            <PriceOptionsList
              options={options}
              selectedType={selectedType}
              onSelect={handleSelect}
              onEditPrice={handleEditPrice}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* ─── DESKTOP: Dropdown ─── */}
      <div className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={triggerLabel}
              title={triggerLabel}
              disabled={disabled}
              className={triggerClass}
            >
              <TagIcon className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align={align}
            sideOffset={8}
            className="w-[240px] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
          >
            <DropdownMenuLabel className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Opciones de precio
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-0 my-1 bg-slate-200 dark:bg-slate-700" />
            {options.length > 0 && (
              <DropdownMenuRadioGroup
                value={selectedType ?? options[0]?.type}
                onValueChange={(value) => onSelect(value as PriceType)}
              >
                {options.map((option) => {
                  const active = option.type === selectedType
                  return (
                    <DropdownMenuRadioItem
                      key={option.type}
                      value={option.type}
                      className={cn(
                        "mb-1 items-start rounded-xl px-3 py-2.5 pl-8 last:mb-0",
                        active && "bg-slate-50 dark:bg-slate-800/80",
                      )}
                    >
                      <div className="flex w-full min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex h-2.5 w-2.5 rounded-full",
                              getOptionAccentClass(option.type),
                            )}
                          />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {option.label}
                          </span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {formatMoney(option.value)}
                        </span>
                      </div>
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            )}
            {onEditPrice && (
              <>
                {options.length > 0 && (
                  <DropdownMenuSeparator className="mx-0 my-1 bg-slate-200 dark:bg-slate-700" />
                )}
                <button
                  type="button"
                  onClick={onEditPrice}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-blue-400"
                >
                  <PencilSquareIcon className="h-4 w-4 shrink-0" />
                  Editar precio manualmente
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
