"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarDays } from "lucide-react"

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

// ─── Tooltip personalizado ────────────────────────────────────────────────────
function PaymentTooltip({ payment, monthLabel }: {
  payment: { is_paid: boolean; amount?: number; paid_at?: string } | null
  monthLabel: string
}) {
  if (!payment || !payment.is_paid) {
    return (
      <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none
        bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
        <p className="font-bold">{monthLabel}</p>
        <p className="text-slate-300">Sin cobrar</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    )
  }

  const paidDate = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null

  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none
      bg-emerald-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
      <p className="font-bold">{monthLabel}</p>
      {payment.amount != null && (
        <p className="text-emerald-200 font-black text-sm">
          {payment.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
        </p>
      )}
      {paidDate && <p className="text-emerald-300 text-[10px]">Cobrado el {paidDate}</p>}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-emerald-800" />
    </div>
  )
}

// ─── Punto de pago ─────────────────────────────────────────────────────────────
function PaymentDot({ payment, monthIndex, year, propertyId, onRefresh }: {
  payment: { is_paid: boolean; amount?: number; paid_at?: string } | null
  monthIndex: number
  year: string
  propertyId: number
  onRefresh: () => void
}) {
  const [showTip, setShowTip] = useState(false)
  const [loading, setLoading] = useState(false)

  const isPaid = payment?.is_paid ?? false
  const monthLabel = `${MONTHS[monthIndex]} ${year}`

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      if (isPaid) {
        // Desmarcar como cobrado
        await supabase.from("rent_payments").delete()
          .eq("property_id", propertyId)
          .eq("month", monthIndex)
          .eq("year", parseInt(year))
      } else {
        // Marcar como cobrado (sin importe personalizado desde aquí; usar "Registrar Cobro" para eso)
        await supabase.from("rent_payments").upsert({
          property_id: propertyId,
          month: monthIndex,
          year: parseInt(year),
          is_paid: true,
          paid_at: new Date().toISOString(),
        }, { onConflict: "property_id, month, year" })
      }
      onRefresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      {/* Tooltip al pasar el ratón */}
      {showTip && (
        <PaymentTooltip payment={payment} monthLabel={monthLabel} />
      )}

      <button
        onClick={handleClick}
        disabled={loading}
        title={monthLabel}
        className={`
          w-5 h-5 rounded-full border-2 transition-all duration-200 cursor-pointer
          ${loading ? "opacity-40 scale-90" : "hover:scale-125"}
          ${isPaid
            ? "bg-emerald-500 border-emerald-600 shadow-sm shadow-emerald-300"
            : "bg-white border-slate-300 hover:border-slate-400"
          }
        `}
      />
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function OccupancyTracker({ year: globalYear }: { year: string }) {
  // El tracker tiene su PROPIO selector de año (independiente del global)
  const [localYear, setLocalYear] = useState(globalYear || new Date().getFullYear().toString())
  const [properties, setProperties] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Si cambia el año global, sincronizamos el local
  useEffect(() => { setLocalYear(globalYear) }, [globalYear])

  async function fetchData() {
    const [propRes, payRes] = await Promise.all([
      supabase.from("properties").select("id, name, price, status").order("name"),
      supabase.from("rent_payments")
        .select("property_id, month, year, is_paid, amount, paid_at")
        .eq("year", parseInt(localYear)),
    ])
    if (propRes.data) setProperties(propRes.data)
    if (payRes.data)  setPayments(payRes.data)
  }

  useEffect(() => { fetchData() }, [localYear, refreshKey])

  function getPayment(propertyId: number, month: number) {
    return payments.find(p => p.property_id === propertyId && p.month === month) ?? null
  }

  function countPaidMonths(propertyId: number): number {
    return payments.filter(p => p.property_id === propertyId && p.is_paid).length
  }

  // Suma total cobrado para un inmueble en el año (respeta distintos importes por mes)
  function totalCollected(propertyId: number): number {
    return payments
      .filter(p => p.property_id === propertyId && p.is_paid)
      .reduce((acc, p) => acc + (p.amount || 0), 0)
  }

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm w-full overflow-x-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" /> Tracker de Cobros
        </h2>

        {/* ─── SELECTOR DE AÑO PROPIO ─── */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Año:</span>
          <Select value={localYear} onValueChange={setLocalYear}>
            <SelectTrigger className="w-[90px] h-8 font-black text-blue-700 bg-blue-50 border-blue-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-w-[700px]">
        {/* Cabecera meses */}
        <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: "200px repeat(12, 1fr) 80px 100px" }}>
          <div />
          {MONTHS.map((m) => (
            <div key={m} className="text-center text-[10px] font-bold text-slate-400 uppercase">{m}</div>
          ))}
          <div className="text-center text-[10px] font-bold text-slate-400 uppercase">Meses</div>
          <div className="text-center text-[10px] font-bold text-slate-400 uppercase">Cobrado</div>
        </div>

        {/* Filas de inmuebles */}
        {properties.map((prop) => {
          const paid = countPaidMonths(prop.id)
          const collected = totalCollected(prop.id)

          return (
            <div key={prop.id} className="grid items-center gap-1 py-2 border-t border-slate-100"
              style={{ gridTemplateColumns: "200px repeat(12, 1fr) 80px 100px" }}>
              {/* Nombre */}
              <div className="pr-2">
                <p className="text-sm font-bold text-slate-700 truncate">{prop.name}</p>
                <p className="text-[10px] text-slate-400">
                  {prop.price ? `${prop.price.toLocaleString("es-ES")} €/mes` : "Sin precio"}
                </p>
              </div>

              {/* 12 puntos */}
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="flex justify-center">
                  <PaymentDot
                    payment={getPayment(prop.id, i)}
                    monthIndex={i}
                    year={localYear}
                    propertyId={prop.id}
                    onRefresh={() => setRefreshKey(k => k + 1)}
                  />
                </div>
              ))}

              {/* Meses cobrados */}
              <div className="text-center">
                <span className={`text-sm font-black ${paid === 12 ? "text-emerald-600" : paid >= 6 ? "text-amber-600" : "text-slate-500"}`}>
                  {paid}/12
                </span>
              </div>

              {/* Total cobrado en el año */}
              <div className="text-center">
                <span className="text-sm font-black text-emerald-700">
                  {collected > 0 ? `${collected.toLocaleString("es-ES", { minimumFractionDigits: 0 })} €` : "—"}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-slate-400 mt-4">
        💡 Pasa el ratón sobre un punto para ver el importe cobrado ese mes. Haz clic para marcar/desmarcar.
        Usa <strong>Registrar Cobro</strong> para registrar un importe distinto al habitual.
      </p>
    </div>
  )
}
