"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AnalyticsChartProps {
  year: string
}

export function AnalyticsChart({ year }: AnalyticsChartProps) {
  const [data, setData] = useState<any[]>([])

  async function fetchChartData() {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const { data: properties, error } = await supabase
      .from('properties')
      .select(`
        name, 
        price, 
        expenses(amount, date)
      `)

    if (!error && properties) {
      const chartMap = properties.map(p => {
        // Filtrar gastos por año manualmente para cada propiedad
        const yearlyExpenses = p.expenses?.filter((e: any) => 
          e.date >= startDate && e.date <= endDate
        ) || []
        
        return {
          name: p.name,
          ingresos: p.price || 0,
          gastos: yearlyExpenses.reduce((acc: number, curr: any) => acc + curr.amount, 0)
        }
      })
      setData(chartMap)
    }
  }

  useEffect(() => {
    fetchChartData()
  }, [year])

  return (
    <Card className="col-span-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-800">Comparativa Rentabilidad {year}</CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value) => `${value} €`}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Legend />
            <Bar dataKey="ingresos" fill="#2563eb" name="Ingresos (Renta)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" fill="#ef4444" name="Gastos Deducibles" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}