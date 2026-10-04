"use client"

import { CreditCardIcon, GiftIcon, Squares2X2Icon } from "@heroicons/react/24/outline"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ComboPromocionesTab } from "@/components/empresa/ComboPromocionesTab"
import { MetodosPagoTab } from "@/components/empresa/MetodosPagoTab"
import { OfertasEcommerceTab } from "@/components/empresa/OfertasEcommerceTab"

export default function EmpresaPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="metodos-pago" className="space-y-6">
        <TabsList className="inline-flex h-auto w-full rounded-xl border border-border bg-muted/40 p-1 sm:w-auto">
          <TabsTrigger
            value="metodos-pago"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold sm:flex-none"
          >
            <CreditCardIcon className="h-4 w-4" />
            Metodos de pago
          </TabsTrigger>
          <TabsTrigger
            value="ofertas"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold sm:flex-none"
          >
            <GiftIcon className="h-4 w-4" />
            Ofertas
          </TabsTrigger>
          <TabsTrigger
            value="combos"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold sm:flex-none"
          >
            <Squares2X2Icon className="h-4 w-4" />
            Combos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metodos-pago">
          <MetodosPagoTab />
        </TabsContent>

        <TabsContent value="ofertas">
          <OfertasEcommerceTab />
        </TabsContent>

        <TabsContent value="combos">
          <ComboPromocionesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
