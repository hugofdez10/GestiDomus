"use client"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import * as XLSX from 'xlsx'

export function ExportReport() {
  async function downloadExcel() {
    // 1. Traemos toda la foto actual de la base de datos
    const { data: properties } = await supabase
      .from('properties')
      .select('*, tenants(full_name), expenses(*)')

    if (!properties) return

    // 2. Formateamos los datos para que el gestor los entienda
    const reportData = properties.map(p => ({
      Inmueble: p.name,
      Inquilino: p.tenants?.[0]?.full_name || 'Vacante',
      'Ingresos Brutos': p.price,
      'Gastos Totales': p.expenses?.reduce((acc: number, curr: any) => acc + curr.amount, 0) || 0,
      'Beneficio Neto': p.price - (p.expenses?.reduce((acc: number, curr: any) => acc + curr.amount, 0) || 0),
      Estado: p.status
    }))

    // 3. Crear el libro de Excel
    const worksheet = XLSX.utils.json_to_sheet(reportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Balance GestiDomus")

    // 4. Descargar
    XLSX.writeFile(workbook, `Informe_GestiDomus_${new Date().getFullYear()}.xlsx`)
  }

  return (
    <Button 
      variant="outline" 
      onClick={downloadExcel}
      className="bg-emerald-50 border-emerald-600 text-emerald-700 hover:bg-emerald-100"
    >
      <span>📊</span> Exportar Excel
    </Button>
  )
}