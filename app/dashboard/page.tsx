"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PropertyList } from "@/components/ui/dashboard/property-list"
import { AddPropertyForm } from "@/components/ui/dashboard/add-property-form"
import { AddExpenseForm } from "@/components/ui/dashboard/add-expense-form"
import { ExpenseList } from "@/components/ui/dashboard/expense-list"
import { AnalyticsChart } from "@/components/ui/dashboard/analytics-chart"
import { FiscalReportButton } from "@/components/ui/dashboard/fiscal-report-button"
import { TaxSimulator } from "@/components/ui/dashboard/tax-simulator"
import { OccupancyTracker } from "@/components/ui/dashboard/occupancy-tracker"
import { RentAction } from "@/components/ui/dashboard/rent-action"
import { PaymentTracker } from "@/components/ui/dashboard/payment-tracker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, TrendingUp } from "lucide-react"
import { motion, type Variants } from "framer-motion"
import { ContractAvisos } from "@/components/ui/dashboard/contract-avisos"

type DashboardAlert = {
  category?: string | null
  expiry_date?: string | null
  properties?: { name?: string | null } | null
}

export default function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [totalAmortization, setTotalAmortization] = useState(0)
  const [alerts, setAlerts] = useState<DashboardAlert[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const calculateMetrics = useCallback(async () => {
    const startDate = `${selectedYear}-01-01`
    const endDate = `${selectedYear}-12-31`

    const { data: propData } = await supabase
      .from("properties")
      .select("price, construction_value")

    const { data: expData } = await supabase
      .from("expenses")
      .select("amount")
      .gte("date", startDate)
      .lte("date", endDate)

    if (propData) {
      setTotalRevenue(
        propData.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) * 12
      )
      setTotalAmortization(
        propData.reduce((acc, curr) => acc + (Number(curr.construction_value) || 0), 0) * 0.03
      )
    }

    if (expData) {
      setTotalExpenses(
        expData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
      )
    }

    const today = new Date().toISOString()
    const limit = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()

    const { data: expAlerts } = await supabase
      .from("expenses")
      .select("category, expiry_date, properties(name)")
      .gte("expiry_date", today)
      .lte("expiry_date", limit)

    if (expAlerts) setAlerts(expAlerts as DashboardAlert[])

    setRefreshKey((prev) => prev + 1)
  }, [selectedYear])

  useEffect(() => {
    void Promise.resolve().then(calculateMetrics)
  }, [calculateMetrics])

  const netRealIncome = totalRevenue - totalExpenses - totalAmortization

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }
    })
  }

  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase flex items-center gap-3">
            GestiDomus <span className="text-white bg-blue-700 px-3 py-1 rounded-xl text-2xl shadow-lg shadow-blue-200">OS</span>
          </h1>
          <p className="text-slate-500 font-semibold mt-2 tracking-wide">Sistema Operativo de Gestión Patrimonial</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-2xl border shadow-sm ring-1 ring-black/5"
        >
          <div className="flex items-center gap-2 mr-4 border-r pr-4">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Ejercicio</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[90px] h-9 bg-slate-100/50 border-none font-bold text-blue-700 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <RentAction onUpdate={calculateMetrics} />
            <FiscalReportButton year={selectedYear} />
            <AddExpenseForm />
            <AddPropertyForm onCreated={calculateMetrics} />
          </div>
        </motion.div>
      </div>

      {alerts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-800 shadow-sm flex items-start gap-4 ring-1 ring-red-200/50"
        >
          <div className="bg-red-500 p-2 rounded-xl shadow-lg shadow-red-200">
            <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <p className="font-black uppercase text-[10px] tracking-widest text-red-600 mb-1">Vencimientos críticos</p>
            {alerts.map((alert, index) => (
              <p key={index} className="text-sm font-medium">
                {alert.category} en <span className="underline decoration-red-300 underline-offset-4">{alert.properties?.name}</span> ({alert.expiry_date})
              </p>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants}>
          <Card className="h-full relative overflow-hidden border-none shadow-xl shadow-slate-200/50 bg-white group transition-all hover:scale-[1.02]">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
            <CardHeader className="pb-2">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex justify-between items-center">
                Ingresos Brutos
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <TrendingUp className="w-3 h-3" />
                </span>
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                {totalRevenue.toLocaleString("es-ES")} <span className="text-lg text-slate-400 font-medium">€</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Proyectado anual</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants}>
          <Card className="h-full relative overflow-hidden border-none shadow-xl shadow-slate-200/50 bg-white group transition-all hover:scale-[1.02]">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
            <CardHeader className="pb-2">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex justify-between items-center">
                Gastos Deducibles
                <span className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                  <TrendingUp className="w-3 h-3 rotate-180" />
                </span>
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-rose-600 tabular-nums tracking-tight">
                -{totalExpenses.toLocaleString("es-ES")} <span className="text-lg text-rose-300 font-medium">€</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Total acumulado</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}>
          <Card className="h-full relative overflow-hidden border-none shadow-xl shadow-slate-200/50 bg-white group transition-all hover:scale-[1.02]">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <CardHeader className="pb-2">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex justify-between items-center">
                Ahorro Fiscal
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <TrendingUp className="w-3 h-3" />
                </span>
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-600 tabular-nums tracking-tight">
                {totalAmortization.toLocaleString("es-ES")} <span className="text-lg text-emerald-300 font-medium">€</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Amortización 3%</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}>
          <TaxSimulator netIncome={netRealIncome} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/60"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight uppercase">
                <span className="text-2xl">🏠</span>
                GESTIÓN DE ACTIVOS
              </h2>
              <div className="h-1 w-64 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 w-3/4 rounded-full" />
              </div>
            </div>
            <PropertyList refreshKey={refreshKey} />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white p-8 rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/60"
          >
            <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3 tracking-tight uppercase">
               <span className="text-2xl">📈</span>
               RENDIMIENTO HISTÓRICO
            </h2>
            <AnalyticsChart year={selectedYear} />
          </motion.div>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <ContractAvisos />
        <PaymentTracker />
        <OccupancyTracker key={`occ-${refreshKey}`} year={selectedYear} />
        <ExpenseList year={selectedYear} />
      </div>
    </div>
  )
}
