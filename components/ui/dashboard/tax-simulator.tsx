"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/dashboard/progress"
import { Info } from "lucide-react"

interface TaxSimulatorProps {
  netIncome: number // Beneficio tras gastos y amortización
}

export function TaxSimulator({ netIncome }: TaxSimulatorProps) {
  // Estimación del 20% de IRPF (puedes ajustarlo según tu tramo real)
  const estimatedTaxRate = 0.20 
  const estimatedTax = netIncome > 0 ? netIncome * estimatedTaxRate : 0
  
  // Calculamos el porcentaje de "limpieza" del beneficio
  const netAfterTax = netIncome - estimatedTax

  return (
    <Card className="border-l-4 border-l-orange-400 bg-orange-50/30 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-orange-800 flex items-center gap-2">
          <Info className="w-4 h-4" /> Proyección IRPF Estimada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-orange-600 uppercase font-bold tracking-wider">A pagar (Hacienda)</p>
            <div className="text-2xl font-black text-orange-700">
              {estimatedTax.toLocaleString('es-ES')} €
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase">Dinero Limpio</p>
            <p className="text-lg font-bold text-slate-700">
              {netAfterTax.toLocaleString('es-ES')} €
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
            <span>Provisionado</span>
            <span>{estimatedTaxRate * 100}% de retención</span>
          </div>
          <Progress value={estimatedTaxRate * 100} className="h-2 bg-orange-200" />
        </div>
        
        <p className="text-[10px] text-orange-600 italic leading-tight">
          * Basado en el rendimiento neto tras deducir gastos y amortización del 3%. 
          El tipo impositivo final depende de tus otros ingresos personales.
        </p>
      </CardContent>
    </Card>
  )
}