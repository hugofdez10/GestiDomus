"use client"

import { AddTenantForm } from "@/components/ui/dashboard/add-tenant-form"
import { TenantList } from "@/components/ui/dashboard/tenant-list"
import { Users } from "lucide-react"

export default function TenantsPage() {
  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600" />
            Inquilinos
          </h1>
          <p className="text-slate-500 mt-2">
            Gestiona la cartera de inquilinos, su contacto y su documentación.
          </p>
        </div>

        <div className="flex justify-start lg:justify-end">
          <AddTenantForm triggerClassName="shadow-sm" />
        </div>
      </div>

      <TenantList />
    </div>
  )
}