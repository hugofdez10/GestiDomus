"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PropertyList } from "@/components/ui/dashboard/property-list"
import { AddPropertyForm } from "@/components/ui/dashboard/add-property-form"
import { AddExpenseForm } from "@/components/ui/dashboard/add-expense-form"
import { AddTenantForm } from "@/components/ui/dashboard/add-tenant-form"
import { AddTaskForm } from "@/components/ui/dashboard/add-task-form"
import { ExpenseList } from "@/components/ui/dashboard/expense-list"
import { MaintenanceList } from "@/components/ui/dashboard/maintenance-list"
import { AnalyticsChart } from "@/components/ui/dashboard/analytics-chart"
import { FiscalReportButton } from "@/components/ui/dashboard/fiscal-report-button"
import { TaxSimulator } from "@/components/ui/dashboard/tax-simulator"
import { OccupancyTracker } from "@/components/ui/dashboard/occupancy-tracker"
import { RentAction } from "@/components/ui/dashboard/rent-action"
import { TenantList } from "@/components/ui/dashboard/tenant-list"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, AlertTriangle, TrendingUp, Building2, Users } from "lucide-react"

export default function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [totalAmortization, setTotalAmortization] = useState(0)
  const [alerts, setAlerts] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState("finance")

  async function calculateMetrics() {
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
      setTotalRevenue(propData.reduce((acc, curr) => acc + (curr.price || 0), 0) * 12)
      setTotalAmortization(
        propData.reduce((acc, curr) => acc + (curr.construction_value || 0), 0) * 0.03
      )
    }

    if (expData) {
      setTotalExpenses(expData.reduce((acc, curr) => acc + (curr.amount || 0), 0))
    }

    const today = new Date().toISOString()
    const limit = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()

    const { data: expAlerts } = await supabase
      .from("expenses")
      .select("category, expiry_date, properties(name)")
      .gte("expiry_date", today)
      .lte("expiry_date", limit)

    if (expAlerts) setAlerts(expAlerts)

    setRefreshKey((prev) => prev + 1)
  }

  useEffect(() => {
    setActiveTab("finance")
  }, [])

  useEffect(() => {
    calculateMetrics()
  }, [selectedYear])

  const netRealIncome = totalRevenue - totalExpenses - totalAmortization

  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase flex items-center gap-3">
            GestiDomus <span className="text-blue-600 bg-blue-100 px-3 py-1 rounded-lg text-2xl">OS</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2">Sistema Operativo de Gestión Patrimonial</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 mr-4 border-r pr-4">
            <span className="text-slate-400 text-xs font-bold uppercase">Ejercicio:</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-8 bg-slate-50 border-none font-black text-blue-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <RentAction onUpdate={calculateMetrics} />
          <FiscalReportButton year={selectedYear} />
          <AddTaskForm />
          <AddExpenseForm />
          <AddPropertyForm />
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-800 shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 animate-pulse" />
          <div>
            <p className="font-bold uppercase text-xs tracking-wider">Vencimientos Críticos:</p>
            {alerts.map((a, i) => (
              <p key={i} className="text-sm">
                {a.category} en <strong>{a.properties.name}</strong> ({a.expiry_date})
              </p>
            ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-8 bg-slate-200/50 p-1 rounded-lg">
          <TabsTrigger
            value="finance"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold flex gap-2"
          >
            <Building2 className="w-4 h-4" /> Finanzas y Activos
          </TabsTrigger>
          <TabsTrigger
            value="tenants"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold flex gap-2"
          >
            <Users className="w-4 h-4" /> Inquilinos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="finance" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-600 shadow-sm">
              <CardHeader className="pb-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Ingresos Brutos Anuales
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">{totalRevenue.toLocaleString("es-ES")} €</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-sm">
              <CardHeader className="pb-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Gastos Deducibles
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-red-600">
                  -{totalExpenses.toLocaleString("es-ES")} €
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 shadow-sm">
              <CardHeader className="pb-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Ahorro Amortización
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-emerald-600">
                  -{totalAmortization.toLocaleString("es-ES")} €
                </div>
              </CardContent>
            </Card>

            <TaxSimulator netIncome={netRealIncome} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  🏠 Salud de Activos
                </h2>
                <PropertyList key={`props-${refreshKey}`} />
              </div>

              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" /> Rendimiento
                </h2>
                <AnalyticsChart year={selectedYear} />
              </div>
            </div>

            <div className="space-y-8">
              <div className="p-6 bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
                <h2 className="text-sm font-black text-amber-800 uppercase mb-4 tracking-widest flex items-center gap-2">
                  🔨 Mantenimiento
                </h2>
                <MaintenanceList key={`maint-${refreshKey}`} />
              </div>
            </div>
          </div>

          <OccupancyTracker key={`occ-${refreshKey}`} year={selectedYear} />
          <ExpenseList year={selectedYear} />
        </TabsContent>

        <TabsContent value="tenants" className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <TenantList />
            </div>

            <div>
              <Card className="bg-blue-600 text-white shadow-lg">
                <CardHeader>
                  <h3 className="font-black text-xl flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-yellow-300" /> Centro de Control
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4 text-blue-100">
                  <p className="text-sm leading-relaxed">
                    Desde este panel puedes auditar el estado de todos tus contratos. El sistema te avisará 60 días antes de que un contrato expire para que decidas si renuevas o buscas un nuevo perfil.
                  </p>
                  <div className="pt-4 border-t border-blue-500/50">
                    <p className="text-xs font-bold uppercase tracking-widest mb-4 text-blue-200">
                      Acciones Rápidas
                    </p>
                    <AddTenantForm />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}