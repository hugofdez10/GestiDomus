"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Bell, AlertTriangle, AlertCircle } from "lucide-react"

type ContractAlert = {
  id: string
  tenant_name: string
  property_name: string
  end_date: string
  days_remaining: number
}

function formatDateEs(dateStr: string) {
  const part = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr
  const [y, m, d] = part.split("-")
  return `${d}/${m}/${y}`
}

function alertStyle(days: number) {
  if (days < 0) return "bg-red-50 border-red-200"
  if (days <= 7) return "bg-orange-50 border-orange-200"
  return "bg-yellow-50 border-yellow-200"
}

function AlertIcon({ days }: { days: number }) {
  if (days < 0) return <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
  if (days <= 7) return <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
  return <Bell className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
}

function daysText(days: number) {
  if (days < 0) return `Vencido hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""} — revisar estado del contrato`
  if (days === 0) return "Vence hoy — contactar urgente"
  if (days === 1) return "Vence mañana — contactar urgente"
  return `${days} días restantes — contactar para confirmar salida o prórroga`
}

function textColor(days: number) {
  if (days < 0) return "text-red-800"
  if (days <= 7) return "text-orange-800"
  return "text-yellow-800"
}

export function ContractAvisos() {
  const [alerts, setAlerts] = useState<ContractAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAlerts() {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, contract_status, end_date, tenants(full_name), properties(name)")
        .in("contract_status", ["active", "activo", "renewed", "prorrogado", "signed"])
        .not("end_date", "is", null)

      if (error || !data) {
        setLoading(false)
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const result: ContractAlert[] = []

      for (const c of data) {
        if (!c.end_date) continue
        const endPart = c.end_date.includes("T") ? c.end_date.split("T")[0] : c.end_date
        const end = new Date(`${endPart}T00:00:00`)
        const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        if (days > 15) continue

        const tenantRel = c.tenants
        const tenant = Array.isArray(tenantRel) ? tenantRel[0] : tenantRel
        const propertyRel = c.properties
        const property = Array.isArray(propertyRel) ? propertyRel[0] : propertyRel

        result.push({
          id: c.id,
          tenant_name: (tenant as { full_name?: string } | null)?.full_name || "Inquilino desconocido",
          property_name: (property as { name?: string } | null)?.name || "Inmueble desconocido",
          end_date: c.end_date,
          days_remaining: days,
        })
      }

      result.sort((a, b) => a.days_remaining - b.days_remaining)
      setAlerts(result)
      setLoading(false)
    }

    fetchAlerts()
  }, [])

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-slate-200/60 p-8">
      <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3 tracking-tight uppercase">
        <span className="text-2xl">🔔</span>
        AVISOS
      </h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
          <Bell className="w-8 h-8 opacity-25" />
          <p className="font-semibold text-sm">No hay avisos pendientes.</p>
          <p className="text-xs text-center max-w-xs">
            Los contratos que venzan en los próximos 15 días aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-4 rounded-xl border ${alertStyle(alert.days_remaining)}`}
            >
              <AlertIcon days={alert.days_remaining} />
              <div className={`flex-1 min-w-0 ${textColor(alert.days_remaining)}`}>
                <p className="font-bold text-sm leading-snug">
                  {alert.tenant_name}
                  <span className="font-normal text-xs ml-2 opacity-70">· {alert.property_name}</span>
                </p>
                <p className="text-xs mt-0.5 opacity-90">
                  Vence el {formatDateEs(alert.end_date)} — {daysText(alert.days_remaining)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
