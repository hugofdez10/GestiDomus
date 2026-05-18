"use client"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

type ReportProperty = {
  name?: string | null
  price?: number | null
  status?: string | null
  tenants?: Array<{ full_name?: string | null }> | null
  expenses?: Array<{ amount?: number | null }> | null
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(fileName: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\n")

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function ExportReport() {
  async function downloadReport() {
    const { data: properties } = await supabase
      .from("properties")
      .select("*, tenants(full_name), expenses(*)")

    if (!properties) return

    const reportData = (properties as ReportProperty[]).map((property) => {
      const totalExpenses = property.expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0
      const price = Number(property.price || 0)

      return {
        Inmueble: property.name || "",
        Inquilino: property.tenants?.[0]?.full_name || "Vacante",
        "Ingresos Brutos": price,
        "Gastos Totales": totalExpenses,
        "Beneficio Neto": price - totalExpenses,
        Estado: property.status || "",
      }
    })

    downloadCsv(`Informe_GestiDomus_${new Date().getFullYear()}.csv`, reportData)
  }

  return (
    <Button
      variant="outline"
      onClick={downloadReport}
      className="bg-emerald-50 border-emerald-600 text-emerald-700 hover:bg-emerald-100"
    >
      <span>Exportar CSV</span>
    </Button>
  )
}
