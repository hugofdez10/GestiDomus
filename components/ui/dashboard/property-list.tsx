"use client"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getActiveContractForProperty, type ContractWithTenantLike } from "@/lib/contracts"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PropertyDocs } from "./property-docs"
import { EditPropertyForm } from "./edit-property-form"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Eye, FileDown, FileText, Home, Landmark, ShieldCheck, TrendingUp, Trash2, Zap } from "lucide-react"
import { exportTablePdf, formatEuro } from "@/lib/pdf-export"
import { smoothListItemMotion } from "./smooth-motion"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

function statusLabel(status?: string | null) {
  if (status === "occupied") return "Ocupado"
  if (status === "vacant") return "Vacante"
  if (status === "maintenance") return "En obras"
  return status || "Sin estado"
}

type SupplyInfo = {
  company?: string | null
  contract?: string | null
}

type PropertyRow = {
  id: number
  name?: string | null
  address?: string | null
  status?: string | null
  price?: number | null
  purchase_price?: number | null
  construction_value?: number | null
  payment_account_holder?: string | null
  payment_account_iban?: string | null
  sender_email?: string | null
  insurance_company?: string | null
  insurance_policy_number?: string | null
  cadastral_ref?: string | null
  area_m2?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  max_occupants?: number | null
  supplies?: Record<string, SupplyInfo | undefined> | null
  expenses?: { amount?: number | null }[]
  currentTenantName?: string
  healthColor?: string
  roi?: number
}

type PropertyContract = ContractWithTenantLike & {
  monthly_rent?: number | null
}

function supplyValue(supplies: PropertyRow["supplies"], key: string, field: "company" | "contract") {
  return supplies?.[key]?.[field] || "—"
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-700 text-right">{value || "—"}</span>
    </div>
  )
}

function PropertySkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-3 w-3 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-2 h-3 w-24" />
            <Skeleton className="mt-2 h-3 w-56" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell>
            <div className="flex justify-end gap-1">
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

export function PropertyList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const hasFetchedRef = useRef(false)
  const shouldReduceMotion = useReducedMotion()

  const fetchProperties = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true)
    const [propertiesRes, contractsRes] = await Promise.all([
      supabase
        .from('properties')
        .select('*, expenses(amount)'),
      supabase
        .from("contracts")
        .select("id, property_id, tenant_id, contract_status, start_date, end_date, monthly_rent, tenants(full_name)"),
    ])
    const { data, error } = propertiesRes
    const contracts = (contractsRes.data || []) as unknown as PropertyContract[]
    
    if (!error && data) {
      const formatted = (data as PropertyRow[])
        .map(p => {
          const activeContract = getActiveContractForProperty(p.id, contracts)
          const tenantRelation = activeContract?.tenants
          const activeTenant = Array.isArray(tenantRelation) ? tenantRelation[0] : tenantRelation
          const monthlyRent = p.price || 0
          const annualRevenue = monthlyRent * 12
          const totalExp = p.expenses?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0
          const amortization = (p.construction_value || 0) * 0.03
          const netProfit = annualRevenue - totalExp - amortization
          const roi = p.purchase_price && p.purchase_price > 0 ? (netProfit / p.purchase_price) * 100 : 0
          
          let healthColor = "bg-emerald-500"
          if (totalExp > (monthlyRent * 0.5)) healthColor = "bg-red-500"
          else if (totalExp > (monthlyRent * 0.2)) healthColor = "bg-amber-500"

          return { ...p, currentTenantName: activeTenant?.full_name || "Vacante", healthColor, roi }
        })
        // ORDEN ALFABÉTICO POR NOMBRE
        .sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
        )

      setProperties(formatted)
    }
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    fetchProperties({ silent: hasFetchedRef.current })
    hasFetchedRef.current = true
  }, [fetchProperties, refreshKey])

  async function handleDelete(id: number, name: string) {
    if (window.confirm(`🚨 ¿ESTÁS SEGURO?\n\nVas a eliminar el inmueble "${name}" de tu cartera. Esta acción no se puede deshacer y borrará los datos vinculados.`)) {
      const { error } = await supabase.from('properties').delete().eq('id', id)
      
      if (!error) {
        setProperties((current) => current.filter((property) => property.id !== id))
      } else {
        alert("Error al eliminar: " + error.message)
      }
    }
  }

  function exportPropertiesPdf() {
    exportTablePdf({
      title: "Inmuebles GestiDomus",
      subtitle: "Ficha resumida de inmuebles, rentas y suministros",
      fileName: `Inmuebles_GestiDomus_${new Date().getFullYear()}.pdf`,
      rows: properties,
      columns: [
        { header: "Inmueble", value: "name" },
        { header: "Direccion", value: (p) => p.address || "" },
        { header: "Estado", value: (p) => statusLabel(p.status) },
        { header: "Renta", value: (p) => formatEuro(p.price) },
        { header: "ROI", value: (p) => `${Number(p.roi || 0).toFixed(2)}%` },
        { header: "Inquilino vigente", value: (p) => p.currentTenantName || "Vacante" },
        { header: "Seguro", value: (p) => `${p.insurance_company || ""} ${p.insurance_policy_number || ""}`.trim() },
        { header: "Electricidad", value: (p) => `${supplyValue(p.supplies, "electricity", "company")} ${supplyValue(p.supplies, "electricity", "contract")}` },
        { header: "Gas", value: (p) => `${supplyValue(p.supplies, "gas", "company")} ${supplyValue(p.supplies, "gas", "contract")}` },
        { header: "Agua", value: (p) => `${supplyValue(p.supplies, "water", "company")} ${supplyValue(p.supplies, "water", "contract")}` },
        { header: "Internet", value: (p) => `${supplyValue(p.supplies, "internet", "company")} ${supplyValue(p.supplies, "internet", "contract")}` },
      ],
    })
  }

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <div className="flex justify-end border-b bg-slate-50 px-3 py-2">
        <button
          type="button"
          onClick={exportPropertiesPdf}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
        >
          <FileDown className="w-3.5 h-3.5" /> PDF inmuebles
        </button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-[50px]">Salud</TableHead>
            <TableHead>Inmueble</TableHead>
            <TableHead>ROI Neto</TableHead>
            <TableHead>Inquilino</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence initial={false}>
            {loading ? (
              <PropertySkeletonRows />
            ) : properties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                  No hay inmuebles en tu cartera.
                </TableCell>
              </TableRow>
            ) : (
              properties.map((p, index) => (
                <motion.tr
                  key={p.id}
                  {...smoothListItemMotion(index, shouldReduceMotion ?? false)}
                  className="hover:bg-slate-50/50 transition-colors duration-200 ease-out border-b last:border-0"
                >
                  <TableCell>
                    <div className={`w-3 h-3 rounded-full ${p.healthColor} shadow-sm`} />
                  </TableCell>

                  <TableCell>
                    <p className="font-bold text-slate-700">{p.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{statusLabel(p.status)}</p>
                    {p.address && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px]">{p.address}</p>}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className={`w-3.5 h-3.5 ${(p.roi || 0) > 5 ? 'text-emerald-500' : 'text-amber-500'}`} />
                      <span className={`font-black ${(p.roi || 0) > 5 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {(p.roi || 0).toFixed(2)}%
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {p.currentTenantName || "Vacante"}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-1">
                      {/* DETALLE */}
                      <Sheet>
                        <SheetTrigger asChild>
                          <button className="p-2 hover:bg-blue-50 rounded-full transition-colors text-blue-600" title="Ver ficha">
                            <Eye className="w-4 h-4" />
                          </button>
                        </SheetTrigger>
                        <SheetContent className="bg-white w-[420px] overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle>Ficha: {p.name}</SheetTitle>
                          </SheetHeader>

                          <div className="mt-6 space-y-5">
                            <section className="rounded-xl border bg-white p-4">
                              <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
                                <Home className="w-4 h-4 text-blue-600" /> Datos del inmueble
                              </h3>
                              <DetailRow label="Direccion" value={p.address} />
                              <DetailRow label="Estado" value={statusLabel(p.status)} />
                              <DetailRow label="Renta mensual" value={formatEuro(p.price)} />
                              <DetailRow label="Precio compra" value={formatEuro(p.purchase_price)} />
                              <DetailRow label="Construccion" value={formatEuro(p.construction_value)} />
                              <DetailRow label="ROI neto" value={`${Number(p.roi || 0).toFixed(2)}%`} />
                            </section>

                            <section className="rounded-xl border bg-white p-4">
                              <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
                                <Landmark className="w-4 h-4 text-emerald-600" /> Fiscal y cobros
                              </h3>
                              <DetailRow label="Referencia catastral" value={p.cadastral_ref} />
                              <DetailRow label="Superficie" value={p.area_m2 ? `${p.area_m2} m²` : ""} />
                              <DetailRow label="Habitaciones" value={p.bedrooms} />
                              <DetailRow label="Baños" value={p.bathrooms} />
                              <DetailRow label="Max. personas" value={p.max_occupants} />
                              <DetailRow label="Titular cobro" value={p.payment_account_holder} />
                              <DetailRow label="IBAN" value={p.payment_account_iban} />
                              <DetailRow label="Email remitente" value={p.sender_email} />
                            </section>

                            <section className="rounded-xl border bg-blue-50 p-4">
                              <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-blue-800">
                                <ShieldCheck className="w-4 h-4" /> Seguro
                              </h3>
                              <DetailRow label="Empresa" value={p.insurance_company} />
                              <DetailRow label="N. de poliza" value={p.insurance_policy_number} />
                            </section>

                            <section className="rounded-xl border bg-amber-50 p-4">
                              <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-amber-800">
                                <Zap className="w-4 h-4" /> Suministros
                              </h3>
                              {[
                                ["Electricidad", "electricity"],
                                ["Gas", "gas"],
                                ["Agua", "water"],
                                ["Internet", "internet"],
                              ].map(([label, key]) => (
                                <div key={key} className="rounded-lg border border-amber-100 bg-white p-3 mb-2 last:mb-0">
                                  <p className="text-xs font-black uppercase tracking-wider text-amber-700">{label}</p>
                                  <DetailRow label="Empresa" value={supplyValue(p.supplies, key, "company")} />
                                  <DetailRow label="Contrato/CUPS" value={supplyValue(p.supplies, key, "contract")} />
                                </div>
                              ))}
                            </section>
                          </div>
                        </SheetContent>
                      </Sheet>

                      {/* EDITAR */}
                      <EditPropertyForm property={p} onUpdate={() => fetchProperties({ silent: true })} />

                      {/* DOCUMENTOS */}
                      <Sheet>
                        <SheetTrigger asChild>
                          <button className="p-2 hover:bg-blue-50 rounded-full transition-colors text-blue-600" title="Expediente">
                            <FileText className="w-4 h-4" />
                          </button>
                        </SheetTrigger>
                        <SheetContent className="bg-white w-[400px]">
                          <SheetHeader>
                            <SheetTitle>Expediente: {p.name}</SheetTitle>
                          </SheetHeader>
                          <div className="mt-6">
                            <PropertyDocs propertyId={String(p.id)} />
                          </div>
                        </SheetContent>
                      </Sheet>

                      {/* BORRAR */}
                      <button 
                        onClick={() => handleDelete(p.id, p.name || "inmueble")}
                        className="p-2 hover:bg-red-50 rounded-full transition-colors text-slate-400 hover:text-red-600" 
                        title="Eliminar Piso"
                      >
                        <Trash2 className="w-4 h-4" />
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
