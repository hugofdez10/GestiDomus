"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  getActiveContractForTenant,
  getContractDisplayStatus,
  getMostRecentContractForTenant,
  type ContractLike,
} from "@/lib/contracts"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, MessageCircle, Trash2, Users } from "lucide-react"
import { EditTenantForm } from "./edit-tenant-form"
import { smoothListItemMotion } from "./smooth-motion"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

type TenantRow = {
  id: number
  full_name: string
  email?: string | null
  phone?: string | null
  property_id?: number | null
  document_url?: string | null
  properties?: { name?: string | null } | null
  contractStatus?: "vigente" | "finalizado" | "sin_contrato"
  contractPropertyName?: string | null
}

type TenantContract = ContractLike & {
  properties?: { name?: string | null } | { name?: string | null }[] | null
}

function TenantSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-2 h-3 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell>
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function TenantList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const hasFetchedRef = useRef(false)
  const shouldReduceMotion = useReducedMotion()

  const fetchTenants = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true)
    const [tenantsRes, contractsRes] = await Promise.all([
      supabase
        .from("tenants")
        .select("id, full_name, email, phone, property_id, document_url, properties(name)")
        .order("full_name"),
      supabase
        .from("contracts")
        .select("id, property_id, tenant_id, contract_status, start_date, end_date, properties(name)"),
    ])

    const contracts = (contractsRes.data || []) as unknown as TenantContract[]

    if (!tenantsRes.error && tenantsRes.data) {
      const mapped = (tenantsRes.data as TenantRow[])
        .map((tenant) => {
          const contract =
            getActiveContractForTenant(tenant.id, contracts) ||
            getMostRecentContractForTenant(tenant.id, contracts)
          const contractStatus = getContractDisplayStatus(contract)
          const propertyRelation = contract?.properties
          const property = Array.isArray(propertyRelation) ? propertyRelation[0] : propertyRelation

          return {
            ...tenant,
            contractStatus,
            contractPropertyName:
              contractStatus === "vigente"
                ? property?.name || null
                : null,
          }
        })
        .sort((a, b) => {
          const aRank = a.contractStatus === "vigente" ? 0 : a.contractStatus === "finalizado" ? 1 : 2
          const bRank = b.contractStatus === "vigente" ? 0 : b.contractStatus === "finalizado" ? 1 : 2
          return aRank - bRank || a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" })
        })

      setTenants(mapped)
    }
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    fetchTenants({ silent: hasFetchedRef.current })
    hasFetchedRef.current = true
  }, [fetchTenants, refreshKey])

  const openWhatsApp = (phone: string | null | undefined, name: string, property?: string | null) => {
    if (!phone) {
      alert("No hay teléfono registrado para este inquilino.")
      return
    }

    const cleanPhone = phone.replace(/\D/g, "")
    const message = encodeURIComponent(
      `Hola ${name}, te escribo desde la administración de ${property || "tu inmueble"}.`
    )

    window.open(`https://wa.me/34${cleanPhone}?text=${message}`, "_blank")
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`🚨 ¿Eliminar el expediente de ${name}?`)) return

    const { error } = await supabase.from("tenants").delete().eq("id", id)

    if (!error) {
      setTenants((current) => current.filter((tenant) => tenant.id !== id))
      return
    }

    if (error.code === "23503") {
      alert("No puedes borrar este inquilino porque tiene contratos vinculados. Finaliza o elimina primero el contrato.")
      return
    }

    alert("Error al eliminar: " + error.message)
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Cartera de Inquilinos
        </h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Inquilino</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Inmueble</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <AnimatePresence initial={false}>
            {loading ? (
              <TenantSkeletonRows />
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                  No hay inquilinos registrados.
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant, index) => (
                <motion.tr
                  key={tenant.id}
                  {...smoothListItemMotion(index, shouldReduceMotion ?? false)}
                  className={`transition-colors duration-200 ease-out ${
                    tenant.contractStatus === "vigente"
                      ? "bg-emerald-50/45 hover:bg-emerald-50"
                      : tenant.contractStatus === "finalizado"
                        ? "bg-slate-50/80 hover:bg-slate-100/70"
                        : "bg-rose-50/25 hover:bg-rose-50/50"
                  }`}
                >
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-700">{tenant.full_name}</p>
                      {tenant.contractStatus === "vigente" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px]">Contrato vigente</Badge>
                      ) : tenant.contractStatus === "finalizado" ? (
                        <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">Contrato finalizado</Badge>
                      ) : (
                        <Badge className="bg-rose-50 text-rose-600 border border-rose-100 text-[10px]">Sin contrato vigente</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">ID #{tenant.id}</p>
                  </TableCell>

                  <TableCell>
                    <p className="text-sm text-slate-700">{tenant.email || "Sin email"}</p>
                    <p className="text-xs text-slate-400">{tenant.phone || "Sin teléfono"}</p>
                  </TableCell>

                  <TableCell className="font-medium text-slate-600">
                    {tenant.contractStatus === "vigente" && tenant.contractPropertyName
                      ? tenant.contractPropertyName
                      : <span className="text-slate-400 italic text-xs">Sin contrato vigente</span>}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      {tenant.document_url && (
                        <a
                          href={tenant.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-blue-100 rounded-full transition-colors text-blue-600"
                          title="Ver documento"
                        >
                          <FileText className="w-4 h-4" />
                        </a>
                      )}

                      <EditTenantForm tenant={tenant} onUpdate={() => fetchTenants({ silent: true })} />

                      <button
                        onClick={() => handleDelete(tenant.id, tenant.full_name)}
                        className="p-2 hover:bg-red-50 rounded-full transition-colors text-slate-400 hover:text-red-600"
                        title="Eliminar inquilino"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => openWhatsApp(tenant.phone, tenant.full_name, tenant.contractPropertyName)}
                        className="inline-flex items-center justify-center p-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full transition-colors shadow-sm"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  )
}
