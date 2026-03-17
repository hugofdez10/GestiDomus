"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Receipt } from "lucide-react"

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

    const { data: activeContracts, error } = await supabase
      .from("contracts")
      .select("id, property_id, tenant_id, monthly_rent, contract_status, start_date, end_date")
      .in("contract_status", ["active", "signed"])
      .lte("start_date", lastDay)
      .gte("end_date", firstDay)

    if (error) {
      alert("Error al cargar contratos activos: " + error.message)
      setLoading(false)
      return
    }

    if (!activeContracts || activeContracts.length === 0) {
      alert("No hay contratos activos para este mes.")
      setLoading(false)
      return
    }

    const payload = activeContracts.map((contract) => ({
      contract_id: contract.id,
      property_id: contract.property_id,
      tenant_id: contract.tenant_id,
      billing_year: year,
      billing_month: month,
      billing_period: firstDay,
      due_date: dueDate,
      amount: contract.monthly_rent,
      status: "pending",
      notes: "Generada automáticamente desde el panel de contratos",
    }))

    const { error: upsertError } = await supabase
      .from("invoices")
      .upsert(payload, { onConflict: "contract_id,billing_year,billing_month" })

    if (upsertError) {
      alert("Error al generar recibos: " + upsertError.message)
      setLoading(false)
      return
    }

    alert(`✅ Recibos del ${paddedMonth}/${year} generados o actualizados: ${payload.length}`)
    onDone()
    setLoading(false)
  }

  return (
    <Button onClick={handleGenerate} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
      <Receipt className="w-4 h-4" />
      {loading ? "Generando..." : "Generar recibos del mes"}
    </Button>
  )
}
