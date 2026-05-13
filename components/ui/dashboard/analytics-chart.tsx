"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LayoutGrid, TrendingUp, Loader2 } from "lucide-react"

type ViewMode = "evolucion" | "propiedades"

export function AnalyticsChart({ year: initialYear }: { year: string }) {
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [viewMode, setViewMode] = useState<ViewMode>("evolucion")
  const [properties, setProperties] = useState<any[]>([])
  const [rentPayments, setRentPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const yearNum = parseInt(selectedYear)

    // 1. Traemos propiedades y sus gastos asociados
    const { data: propData } = await supabase
      .from('properties')
      .select(`id, name, price, expenses(amount, date)`)

    // 2. Traemos los pagos de la tabla 'rent_payments' (la tabla correcta del sistema)
    const { data: payData } = await supabase
      .from('rent_payments')
      .select('amount, month, year, property_id, is_paid')
      .eq('year', yearNum)
      .eq('is_paid', true) // Solo sumamos lo que está marcado como cobrado

    if (propData) setProperties(propData)
    if (payData) setRentPayments(payData)
    
    setLoading(false)
  }, [selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData = useMemo(() => {
    if (!properties.length) return []

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    if (viewMode === "evolucion") {
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      const yearNum = parseInt(selectedYear)

      return months.map((month, index) => {
        const monthIndex = index // En rent_payments los meses son 0-11
        
        // Si el año es futuro o el mes es futuro en el año actual, devolvemos null para que la gráfica no baje a 0
        if (yearNum > currentYear || (yearNum === currentYear && monthIndex > currentMonth)) {
          return { name: month, ingresos: null, gastos: null, neto: null }
        }

        // Ingresos reales: Pagos cobrados en este mes específico de rent_payments
        const monthPayments = rentPayments.filter(p => p.month === monthIndex)
        const ingresos = monthPayments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

        // Gastos reales: Gastos registrados en este mes (basado en expenses.date)
        const monthStr = (index + 1).toString().padStart(2, '0')
        const monthPath = `${selectedYear}-${monthStr}`
        
        let gastos = 0
        properties.forEach(p => {
          const monthExpenses = p.expenses?.filter((e: any) => e.date && e.date.startsWith(monthPath)) || []
          gastos += monthExpenses.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0)
        })

        return { name: month, ingresos, gastos, neto: ingresos - gastos }
      })
    } else {
      // Vista por propiedades (Acumulado real cobrado vs Gastos del año)
      return properties.map(p => {
        const propPayments = rentPayments.filter(pay => pay.property_id === p.id)
        const ingresos = propPayments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

        const startDate = `${selectedYear}-01-01`
        const endDate = `${selectedYear}-12-31`
        const yearlyExpenses = p.expenses?.filter((e: any) => e.date >= startDate && e.date <= endDate) || []
        const gastos = yearlyExpenses.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0)
        
        return {
          name: p.name,
          ingresos,
          gastos,
          neto: ingresos - gastos
        }
      })
    }
  }, [properties, rentPayments, selectedYear, viewMode])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 p-4 rounded-2xl border border-slate-100 shadow-2xl pointer-events-none z-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label} {selectedYear}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-8 items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase">Cobrado Real</span>
              <span className="text-sm font-black text-blue-600 tabular-nums">{payload[0].value.toLocaleString('es-ES')} €</span>
            </div>
            <div className="flex justify-between gap-8 items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase">Gastos</span>
              <span className="text-sm font-black text-rose-500 tabular-nums">{payload[1].value.toLocaleString('es-ES')} €</span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between gap-8 items-center">
              <span className="text-[10px] font-black text-slate-900 uppercase">Margen Real</span>
              <span className={`text-sm font-black tabular-nums ${payload[0].value - payload[1].value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(payload[0].value - payload[1].value).toLocaleString('es-ES')} €
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full relative min-h-[400px]">
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-3xl">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Flujo de Caja Real</span>
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              <button 
                onClick={() => setViewMode("evolucion")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === "evolucion" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Evolución
              </button>
              <button 
                onClick={() => setViewMode("propiedades")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === "propiedades" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Por Inmueble
              </button>
            </div>
          </div>

          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Estado</span>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-slate-600 uppercase">Cobrado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[10px] font-bold text-slate-600 uppercase">Gastos</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-1 rounded-xl flex items-center gap-2 border shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3">Año</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px] h-8 border-none bg-transparent font-black text-blue-700 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white">
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="h-[320px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "evolucion" ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                tickFormatter={(value) => `${value}€`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} isAnimationActive={false} />
              <Area 
                type="monotone" 
                dataKey="ingresos" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorIngresos)" 
                animationDuration={800}
              />
              <Area 
                type="monotone" 
                dataKey="gastos" 
                stroke="#f43f5e" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorGastos)" 
                animationDuration={800}
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 800 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                tickFormatter={(value) => `${value}€`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} isAnimationActive={false} />
              <Bar 
                dataKey="ingresos" 
                fill="#3b82f6" 
                radius={[6, 6, 0, 0]} 
                barSize={30}
                animationDuration={800}
              />
              <Bar 
                dataKey="gastos" 
                fill="#f43f5e" 
                radius={[6, 6, 0, 0]} 
                barSize={30}
                animationDuration={800}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
