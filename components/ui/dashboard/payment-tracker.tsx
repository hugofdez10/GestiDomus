"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Circle, HandCoins } from "lucide-react"

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

export function PaymentTracker() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [rentData, setRentData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchPayments() {
    setLoading(true)
    
    // 1. Traemos TODOS los inmuebles y sus inquilinos asignados
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name, price, tenants(full_name)')
      .order('name')

    // 2. Traemos los pagos del mes y año que estamos mirando en el selector
    const { data: payments } = await supabase
      .from('rent_payments')
      .select('*')
      .eq('year', selectedYear)
      .eq('month', selectedMonth)

    if (properties) {
      const combinedData = properties.map(prop => {
        const paymentRecord = payments?.find(p => p.property_id === prop.id)
        // Buscamos si hay algún inquilino activo en este piso
        const activeTenant = prop.tenants && prop.tenants.length > 0 ? prop.tenants[0].full_name : "Vacío"
        
        return {
          property_id: prop.id,
          property_name: prop.name,
          tenant_name: activeTenant,
          rent_price: prop.price || 0,
          is_paid: paymentRecord ? paymentRecord.is_paid : false,
        }
      })
      setRentData(combinedData)
    }
    setLoading(false)
  }

  // Recargar datos si cambiamos el mes o el año
  useEffect(() => {
    fetchPayments()
  }, [selectedMonth, selectedYear])

  async function togglePayment(item: any) {
    const newStatus = !item.is_paid

    const { error } = await supabase
      .from('rent_payments')
      .upsert({
        property_id: item.property_id,
        month: selectedMonth,
        year: selectedYear,
        amount: item.rent_price,
        is_paid: newStatus,
        paid_at: new Date().toISOString()
      }, { onConflict: 'property_id, month, year' })

    if (error) {
      alert("Error al actualizar el cobro: " + error.message)
    } else {
      fetchPayments() 
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-emerald-600" />
            Auditoría Mensual de Cobros
          </h2>
          <p className="text-sm text-slate-500">Supervisa y corrige el estado de los ingresos mes a mes.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border">
          <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
            <SelectTrigger className="w-[120px] font-bold bg-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {MONTHS.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
            <SelectTrigger className="w-[90px] font-bold bg-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-sm text-slate-500 py-4 col-span-full">Cargando estado de cobros...</p>
        ) : (
          rentData.map((item, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col justify-between p-4 border rounded-xl transition-all ${
                item.is_paid ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white hover:bg-slate-50'
              }`}
            >
              <div className="mb-4">
                <p className="font-black text-slate-800 text-lg">{item.property_name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Inquilino: <span className={item.tenant_name === "Vacío" ? "text-red-400 font-bold" : ""}>{item.tenant_name}</span>
                </p>
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-dashed">
                <span className={`font-black text-lg ${item.is_paid ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {item.rent_price} €
                </span>
                
                <button 
                  onClick={() => togglePayment(item)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors shadow-sm ${
                    item.is_paid 
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                      : 'bg-white border text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.is_paid ? (
                    <><CheckCircle2 className="w-4 h-4" /> Cobrado</>
                  ) : (
                    <><Circle className="w-4 h-4" /> Pendiente</>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}