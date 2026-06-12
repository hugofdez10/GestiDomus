"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Circle, Download } from "lucide-react"
import { exportTablePdf, formatEuro } from "@/lib/pdf-export"
import { motion, AnimatePresence } from "framer-motion"
import { syncInvoicePaymentStatusForPropertyMonth } from "@/lib/invoice-payment-sync"

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

type RentPaymentRow = {
  property_id: number
  property_name: string
  tenant_name: string
  rent_price: number
  is_paid: boolean
}

export function PaymentTracker() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [rentData, setRentData] = useState<RentPaymentRow[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPayments = useCallback(async () => {
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
      const combinedData: RentPaymentRow[] = properties.map(prop => {
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
  }, [selectedMonth, selectedYear])

  // Recargar datos si cambiamos el mes o el año
  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  async function togglePayment(item: RentPaymentRow) {
    const newStatus = !item.is_paid

    const { error } = await supabase
      .from('rent_payments')
      .upsert({
        property_id: item.property_id,
        month: selectedMonth,
        year: selectedYear,
        amount: item.rent_price,
        is_paid: newStatus,
        paid_at: newStatus ? new Date().toISOString() : null
      }, { onConflict: 'property_id, month, year' })

    if (error) {
      alert("Error al actualizar el cobro: " + error.message)
    } else {
      try {
        await syncInvoicePaymentStatusForPropertyMonth(supabase, item.property_id, selectedYear, selectedMonth + 1)
      } catch (syncError) {
        console.error(syncError)
        alert("Cobro actualizado, pero no se pudo sincronizar el estado del recibo.")
      }
      fetchPayments() 
    }
  }

  function exportPaymentsPdf() {
    const totalPaid = rentData
      .filter((item) => item.is_paid)
      .reduce((sum, item) => sum + Number(item.rent_price || 0), 0)
    const totalPending = rentData
      .filter((item) => !item.is_paid)
      .reduce((sum, item) => sum + Number(item.rent_price || 0), 0)

    exportTablePdf({
      title: `Ingresos de alquiler - ${MONTHS[selectedMonth]} ${selectedYear}`,
      fileName: `Ingresos_${selectedYear}_${String(selectedMonth + 1).padStart(2, "0")}.pdf`,
      rows: rentData,
      summary: [
        `Cobrado: ${formatEuro(totalPaid)}`,
        `Pendiente: ${formatEuro(totalPending)}`,
      ],
      columns: [
        { header: "Inmueble", value: "property_name" },
        { header: "Inquilino", value: "tenant_name" },
        { header: "Importe", value: (item) => formatEuro(item.rent_price) },
        { header: "Estado", value: (item) => item.is_paid ? "Cobrado" : "Pendiente" },
      ],
    })
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight uppercase">
            <span className="text-2xl">💰</span>
            Tracker Mensual de Cobros
          </h2>
          <p className="text-sm text-slate-500 font-medium">Marca el alquiler como cobrado y sincroniza los recibos del mes.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-lg border">
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
          <button
            type="button"
            onClick={exportPaymentsPdf}
            className="inline-flex items-center gap-1.5 h-9 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-20 flex flex-col items-center justify-center gap-3 text-slate-400"
            >
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="font-bold text-xs uppercase tracking-widest">Sincronizando cobros...</p>
            </motion.div>
          ) : (
            rentData.map((item, idx) => (
              <motion.div 
                key={item.property_id} 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                className={`flex flex-col justify-between p-4 border rounded-xl transition-all shadow-sm ${
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
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
