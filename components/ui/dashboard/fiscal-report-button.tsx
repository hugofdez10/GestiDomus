"use client"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { FileDown } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export function FiscalReportButton({ year }: { year: string }) {
  async function generatePDF() {
    const doc = new jsPDF()
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const { data: props } = await supabase.from('properties').select('*, expenses(*)')
    
    if (!props) return

    doc.setFontSize(18)
    doc.text(`Informe Fiscal GestiDomus - Ejercicio ${year}`, 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, 14, 30)

    let finalY = 35

    props.forEach((p) => {
      const yearlyExpenses = p.expenses?.filter((e: any) => e.date >= startDate && e.date <= endDate) || []
      const totalExp = yearlyExpenses.reduce((acc: number, curr: any) => acc + curr.amount, 0)
      const amortization = (p.construction_value || 0) * 0.03

      doc.setFontSize(14)
      doc.setTextColor(0)
      doc.text(`Inmueble: ${p.name}`, 14, finalY + 10)

      autoTable(doc, {
        startY: finalY + 15,
        head: [['Concepto', 'Detalle', 'Importe']],
        body: [
          ['Ingresos Brutos Anuales', 'Rentas percibidas', `${(p.price * 12).toLocaleString('es-ES')} €`],
          ['Gastos Deducibles', 'IBI, Seguros, Comunidad, Reparaciones', `-${totalExp.toLocaleString('es-ES')} €`],
          ['Amortización Fiscal (3%)', 'Sobre valor construcción', `-${amortization.toLocaleString('es-ES')} €`],
          ['Rendimiento Neto', 'Base imponible estimada', `${((p.price * 12) - totalExp - amortization).toLocaleString('es-ES')} €`],
        ],
        theme: 'striped',
        // AQUÍ ESTÁ EL CAMBIO: de fillStyle a fillColor
        headStyles: { fillColor: [37, 99, 235] } 
      })

      finalY = (doc as any).lastAutoTable.finalY + 10

      if (finalY > 250) {
        doc.addPage()
        finalY = 20
      }
    })

    doc.save(`Resumen_Fiscal_${year}_GestiDomus.pdf`)
  }

  return (
    <Button 
      onClick={generatePDF}
      variant="outline" 
      className="border-blue-600 text-blue-600 hover:bg-blue-50 flex gap-2"
    >
      <FileDown className="w-4 h-4" /> PDF Fiscal {year}
    </Button>
  )
}