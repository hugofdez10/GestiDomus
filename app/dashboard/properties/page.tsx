"use client"

import { AddPropertyForm } from "@/components/ui/dashboard/add-property-form"
import { PropertyList } from "@/components/ui/dashboard/property-list"
import { Building2 } from "lucide-react"
import { useState } from "react"

export default function PropertiesPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="p-4 sm:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-slate-100 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase flex items-center gap-4">
            <span className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100">
              <Building2 className="w-8 h-8" />
            </span>
            Gestión de Inmuebles
          </h1>
          <p className="text-slate-500 font-semibold mt-4 tracking-wide max-w-2xl">
            Control centralizado de activos: consulta fichas técnicas, suministros y optimización de datos fiscales por cada unidad.
          </p>
        </div>

        <div className="flex justify-start lg:justify-end bg-white p-3 rounded-2xl border border-slate-100 shadow-sm ring-1 ring-black/5">
          <AddPropertyForm onCreated={() => setRefreshKey((key) => key + 1)} />
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50">
        <PropertyList refreshKey={refreshKey} />
      </div>
    </div>
  )
}
