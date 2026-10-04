"use client"

import { type FormEvent, useState } from "react"
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/auth/auth-fetch"
import { normalizePeruvianMobile, sanitizePeruvianMobileInput } from "@/lib/crm/phone"

export type CrmClientTipoDocumento = "SIN_DOC" | "DNI" | "RUC" | "CE"

export interface CrmClientFormValue {
  tipoDocumento: CrmClientTipoDocumento
  nroDocumento: string
  nombres: string
  telefono: string
  correo: string
  direccion: string
}

interface ConsultaDniResponse {
  success?: boolean
  nombres?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
}

interface ConsultaRucResponse {
  razonSocial?: string | null
  nombreComercial?: string | null
  direccion?: string | null
  telefonos?: string[] | null
}

interface CrmClientFormProps {
  value: CrmClientFormValue
  onChange: (value: CrmClientFormValue) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  title?: string
  description?: string
  submitLabel: string
  saving?: boolean
  submitDisabled?: boolean
  onCancel?: () => void
  className?: string
  contentClassName?: string
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

async function readApiMessage(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data.message === "string" ? data.message : fallback
  } catch {
    return fallback
  }
}

export function CrmClientForm({
  value,
  onChange,
  onSubmit,
  title,
  description,
  submitLabel,
  saving,
  submitDisabled,
  onCancel,
  className,
  contentClassName,
}: CrmClientFormProps) {
  const [searchingDocument, setSearchingDocument] = useState(false)

  const update = (patch: Partial<CrmClientFormValue>) => {
    onChange({ ...value, ...patch })
  }

  const documentDigits = onlyDigits(value.nroDocumento)
  const canSearchDocument =
    (value.tipoDocumento === "DNI" && documentDigits.length === 8) ||
    (value.tipoDocumento === "RUC" && documentDigits.length === 11)

  const handleSearchDocument = async () => {
    if (!canSearchDocument || searchingDocument) return
    setSearchingDocument(true)
    try {
      const type = value.tipoDocumento.toLowerCase()
      const response = await authFetch(`/api/documento/${type}/${documentDigits}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo consultar el documento"))
      }
      if (value.tipoDocumento === "DNI") {
        const data = (await response.json()) as ConsultaDniResponse
        const fullName = [
          data.nombres,
          data.apellidoPaterno,
          data.apellidoMaterno,
        ].filter(Boolean).join(" ").trim()
        if (!fullName) {
          toast.error("No se encontro informacion para el DNI")
          return
        }
        update({ nombres: fullName })
        toast.success("DNI encontrado")
        return
      }

      const data = (await response.json()) as ConsultaRucResponse
      const razonSocial = (data.razonSocial || data.nombreComercial || "").trim()
      if (!razonSocial) {
        toast.error("No se encontro informacion para el RUC")
        return
      }
      update({
        nombres: razonSocial,
        direccion: data.direccion?.trim() || value.direccion,
        telefono: value.telefono || normalizePeruvianMobile(data.telefonos?.[0]) || sanitizePeruvianMobileInput(data.telefonos?.[0]),
      })
      toast.success("RUC encontrado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar el documento")
    } finally {
      setSearchingDocument(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-4", className)} onSubmit={onSubmit}>
      {(title || description) && (
        <div className="space-y-1">
          {title ? <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2> : null}
          {description ? <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
      )}

      <div className={cn("grid gap-3", contentClassName)}>
        <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          Nombre completo
          <Input
            value={value.nombres}
            onChange={(event) => update({ nombres: event.target.value })}
            placeholder="Maria Garcia Lopez"
            className="h-10 rounded-lg border-slate-300 text-sm shadow-sm focus-visible:ring-blue-500/20 dark:border-slate-700"
          />
        </label>

        <div className="grid grid-cols-[0.9fr_1.35fr] gap-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            Tipo Doc.
            <select
              value={value.tipoDocumento}
              onChange={(event) => update({
                tipoDocumento: event.target.value as CrmClientTipoDocumento,
                nroDocumento: "",
              })}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="SIN_DOC">Sin documento</option>
              <option value="DNI">DNI</option>
              <option value="RUC">RUC</option>
              <option value="CE">CE</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            Nro. Documento
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                value={value.nroDocumento}
                disabled={value.tipoDocumento === "SIN_DOC"}
                onChange={(event) => update({ nroDocumento: event.target.value })}
                placeholder={value.tipoDocumento === "RUC" ? "20123456789" : "12345678"}
                className="h-10 rounded-lg border-slate-300 text-sm shadow-sm focus-visible:ring-blue-500/20 dark:border-slate-700"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-lg px-3 text-xs"
                disabled={!canSearchDocument || searchingDocument}
                onClick={() => void handleSearchDocument()}
              >
                {searchingDocument ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <MagnifyingGlassIcon className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            Telefono
            <Input
              value={value.telefono}
              onChange={(event) => update({ telefono: sanitizePeruvianMobileInput(event.target.value) })}
              placeholder="987654321"
              className="h-10 rounded-lg border-slate-300 text-sm shadow-sm focus-visible:ring-blue-500/20 dark:border-slate-700"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            Correo (Opcional)
            <Input
              type="email"
              value={value.correo}
              onChange={(event) => update({ correo: event.target.value })}
              placeholder="cliente@email.com"
              className="h-10 rounded-lg border-slate-300 text-sm shadow-sm focus-visible:ring-blue-500/20 dark:border-slate-700"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          Direccion (Opcional)
          <textarea
            value={value.direccion}
            onChange={(event) => update({ direccion: event.target.value })}
            placeholder="Av. Principal 123, Lima"
            className="min-h-20 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {onCancel ? (
          <Button type="button" variant="outline" className="h-9 rounded-lg px-4 text-sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        ) : null}
        <Button
          type="submit"
          className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          disabled={saving || submitDisabled}
        >
          {saving ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
