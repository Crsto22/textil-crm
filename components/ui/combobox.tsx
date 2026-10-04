"use client"

import { useMemo, useState } from "react"
import {
  ArchiveBoxIcon,
  BuildingStorefrontIcon,
  CheckIcon,
  ChevronUpDownIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type ComboboxOptionAvatarIcon = "storefront" | "warehouse"

export interface ComboboxOption {
  value: string
  label: string
  description?: string
  triggerDescription?: string
  avatarText?: string
  avatarIcon?: ComboboxOptionAvatarIcon
  avatarClassName?: string
}

interface ComboboxProps {
  id?: string
  value: string
  options: ComboboxOption[]
  searchValue: string
  onSearchValueChange: (value: string) => void
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  loading?: boolean
  loadingMessage?: string
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  searchInputClassName?: string
  optionClassName?: string
  optionLabelClassName?: string
  optionDescriptionClassName?: string
  onCreateAction?: (query: string) => void
  createActionLabel?: string
  createActionDisabled?: boolean
}

interface ComboboxOptionAvatarProps {
  option: Pick<ComboboxOption, "avatarText" | "avatarIcon" | "avatarClassName">
  size?: "sm" | "md"
  className?: string
}

function getAvatarIcon(icon: ComboboxOptionAvatarIcon) {
  return icon === "warehouse" ? ArchiveBoxIcon : BuildingStorefrontIcon
}

export function ComboboxOptionAvatar({
  option,
  size = "md",
  className,
}: ComboboxOptionAvatarProps) {
  if (!option.avatarIcon && !option.avatarText) return null

  const sizeClasses = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[10px]"
  const iconSizeClasses = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase",
        sizeClasses,
        option.avatarClassName ??
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        className,
      )}
    >
      {option.avatarIcon ? (
        (() => {
          const Icon = getAvatarIcon(option.avatarIcon)
          return <Icon className={iconSizeClasses} />
        })()
      ) : (
        option.avatarText
      )}
    </span>
  )
}

export function Combobox({
  id,
  value,
  options,
  searchValue,
  onSearchValueChange,
  onValueChange,
  placeholder = "Seleccionar opcion...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados.",
  loading = false,
  loadingMessage = "Buscando...",
  disabled = false,
  triggerClassName,
  contentClassName,
  searchInputClassName,
  optionClassName,
  optionLabelClassName,
  optionDescriptionClassName,
  onCreateAction,
  createActionLabel = "Nueva opcion",
  createActionDisabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )
  const selectedTriggerDescription = selectedOption?.triggerDescription

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            selectedTriggerDescription && "h-auto min-h-9 whitespace-normal py-2",
            triggerClassName,
          )}
          disabled={disabled}
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2",
              selectedTriggerDescription && "items-start",
            )}
          >
            {selectedOption?.avatarIcon || selectedOption?.avatarText ? (
              <ComboboxOptionAvatar
                option={selectedOption}
                size="sm"
                className={cn(selectedTriggerDescription && "mt-0.5")}
              />
            ) : null}
            <span className="min-w-0 text-left">
              <span className={cn("block truncate", !selectedOption && "text-muted-foreground")}>
                {selectedOption?.label ?? placeholder}
              </span>
              {selectedTriggerDescription ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {selectedTriggerDescription}
                </span>
              ) : null}
            </span>
          </span>
          <ChevronUpDownIcon className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn("w-[var(--radix-popover-trigger-width)] p-0", contentClassName)}
      >
        <div className="border-b p-2">
          <Input
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
            placeholder={searchPlaceholder}
            className={cn("h-8", searchInputClassName)}
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {onCreateAction ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (createActionDisabled) return
                  onCreateAction(searchValue)
                  setOpen(false)
                }}
                disabled={createActionDisabled}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium transition-colors",
                  createActionDisabled
                    ? "cursor-not-allowed text-muted-foreground opacity-60"
                    : "text-primary hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    createActionDisabled
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <PlusIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{createActionLabel}</span>
                </span>
              </button>

              <div className="my-1 border-t" />
            </>
          ) : null}

          {loading ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{loadingMessage}</p>
          ) : options.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent text-accent-foreground",
                    optionClassName,
                  )}
                >
                  <CheckIcon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.avatarIcon || option.avatarText ? (
                    <ComboboxOptionAvatar option={option} className="mt-0.5" />
                  ) : null}
                  <span className="min-w-0">
                    <span className={cn("block truncate", optionLabelClassName)}>{option.label}</span>
                    {option.description ? (
                      <span className={cn("block truncate text-xs text-muted-foreground", optionDescriptionClassName)}>
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
