"use client"

import { useState } from "react"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Receipt } from "lucide-react"

type ContractForBilling = {
  id: string
  property_id: number
  tenant_id: number
  monthly_rent: number | null
  contract_status: string | null
  start_date: string | null
  end_date: string | null
}

export function GenerateMonthlyInvoicesButton({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const paddedMonth = String(month).padStart(2, "0")
    const firstDay = `${year}-${paddedMonth}-01`
    const lastDay = new Date(year, month, 0).toISOString().split("T")[0]
    const dueDate = `${year}-${paddedMonth}-05`

    setLoading(true)

    try {
      const { data: activeContracts, error } = await supabase
        .from("contracts")
        .select("id, property_id, tenant_id, monthly_rent, contract_status, start_date, end_date")
        .in("contract_status", ["activo", "prorrogado"])
        .lte("start_date", lastDay)
        .gte("end_date", firstDay)

      if (error) {
        throw error
      }

      const validContracts = ((activeContracts ?? []) as ContractForBilling[]).filter(
        (contract) =>
          contract.id &&
          contract.property_id &&
          contract.tenant_id &&
          Number(contract.monthly_rent ?? 0) > 0
      )

      if (validContracts.length === 0) {
        alert("No hay contratos activos o prorrogados facturables para este mes.")
        return
      }

      const payload = validContracts.map((contract) => ({
        contract_id: contract.id,
        property_id: contract.property_id,
        tenant_id: contract.tenant_id,
        billing_year: year,
        billing_month: month,
        billing_period: firstDay,
        due_date: dueDate,
        amount: Number(contract.monthly_rent ?? 0),
        status: "pending",
        notes: "Generada automáticamente desde el panel de contratos",
      }))

      const { error: upsertError } = await supabase
        .from("invoices")
        .upsert(payload, { onConflict: "contract_id,billing_year,billing_month" })

      if (upsertError) {
        throw upsertError
      }

      alert(`✅ Recibos del ${paddedMonth}/${year} generados o actualizados: ${payload.length}`)
      onDone()
    } catch (error: any) {
      alert("Error al generar recibos: " + (error?.message || "Sin detalle"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={loading}
      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
    >
      <Receipt className="w-4 h-4" />
      {loading ? "Generando..." : "Generar recibos del mes"}
    </Button>
  )
}