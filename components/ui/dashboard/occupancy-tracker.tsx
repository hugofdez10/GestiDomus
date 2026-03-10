"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { CalendarDays, CheckCheck } from "lucide-react"

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const MONTHS_LONG = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

export function OccupancyTracker({ year }: { year: string }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchData() {
    setLoading(true)
    
    const { data: properties } = await supabase.from('properties').select('id, name, price').order('name')
    
    const { data: payments } = await supabase
      .from('rent_payments')
      .select('*')
      .eq('year', parseInt(year))

    if (properties) {
      const formattedData = properties.map(prop => {
        const propPayments = payments?.filter(p => p.property_id === prop.id) || []
        return {
          ...prop,
          payments: propPayments
        }
      })
      setData(formattedData)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [year])

  // Cambiar un solo punto manualmente
  async function toggleDot(propertyId: number, monthIndex: number, currentStatus: boolean, price: number) {
    const { error } = await supabase
      .from('rent_payments')
      .upsert({
        property_id: propertyId,
        month: monthIndex,
        year: parseInt(year),
        amount: price || 0,
        is_paid: !currentStatus,
        paid_at: new Date().toISOString()
      }, { onConflict: 'property_id, month, year' })

    if (error) {
      alert("Error al guardar: " + error.message)
    } else {
      fetchData()
    }
  }

  // LA NOVEDAD: Marcar todo el mes como pagado de golpe
  async function markAllAsPaid(monthIndex: number) {
    // Filtramos para actualizar solo los pisos que AÚN NO han pagado ese mes
    const toUpsert = data.filter(prop => {
      const payment = prop.payments.find((p: any) => p.month === monthIndex)
      return !payment?.is_paid
    }).map(prop => ({
      property_id: prop.id,
      month: monthIndex,
      year: parseInt(year),
      amount: prop.price || 0,
      is_paid: true,
      paid_at: new Date().toISOString()
    }))

    if (toUpsert.length === 0) {
      alert(`Todos los inmuebles ya están marcados como cobrados en ${MONTHS_LONG[monthIndex]}.`)
      return
    }

    if (!window.confirm(`¿Marcar los ${toUpsert.length} inmuebles pendientes como COBRADOS en ${MONTHS_LONG[monthIndex]}?`)) return

    // Hacemos una subida masiva a la base de datos
    const { error } = await supabase
      .from('rent_payments')
      .upsert(toUpsert, { onConflict: 'property_id, month, year' })

    if (error) {
      alert("Error al marcar todo como pagado: " + error.message)
    } else {
      fetchData()
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm xl:col-span-3 overflow-x-auto">
      <div className="flex items-center gap-2 mb-6">
        <CalendarDays className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-800">Mapa de Cobros Anual ({year})</h2>
        <div className="ml-auto flex gap-4 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Pagado</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-200"></div> Pendiente</span>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">Cargando cuadrícula...</p>
      ) : (
        <div className="min-w-[700px]">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="pb-4 font-bold text-slate-400 uppercase tracking-widest text-xs align-bottom">Inmueble</th>
                
                {MONTHS_SHORT.map((m, monthIndex) => (
                  <th key={m} className="pb-4 text-center w-12 align-bottom">
                    <div className="flex flex-col items-center gap-2">
                      <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">{m}</span>
                      
                      {/* EL BOTÓN DE COBRAR TODO EL MES */}
                      <button 
                        onClick={() => markAllAsPaid(monthIndex)}
                        title={`Marcar todo como cobrado en ${MONTHS_LONG[monthIndex]}`}
                        className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-700 rounded-md transition-colors shadow-sm"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}

              </tr>
            </thead>
            <tbody>
              {data.map((prop) => (
                <tr key={prop.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors group">
                  <td className="py-3 font-bold text-slate-700 whitespace-nowrap pr-4">{prop.name}</td>
                  
                  {MONTHS_SHORT.map((_, monthIndex) => {
                    const payment = prop.payments.find((p: any) => p.month === monthIndex)
                    const isPaid = payment?.is_paid || false

                    return (
                      <td key={monthIndex} className="text-center py-3">
                        <button 
                          onClick={() => toggleDot(prop.id, monthIndex, isPaid, prop.price)}
                          title={`${prop.name} - ${MONTHS_LONG[monthIndex]}: ${isPaid ? 'Cobrado' : 'Pendiente'}`}
                          className={`w-5 h-5 rounded-full mx-auto transition-all duration-200 block ${
                            isPaid 
                              ? 'bg-emerald-500 shadow-sm shadow-emerald-200 scale-110' 
                              : 'bg-slate-200 hover:bg-slate-300 scale-100'
                          }`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}