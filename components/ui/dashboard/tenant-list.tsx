"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, FileSignature, Trash2, FileText } from "lucide-react"
import { EditTenantForm } from "./edit-tenant-form"

// ─── Utilidad: formato de fecha español dd/mm/aaaa ────────────────────────────
function formatDateES(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "N/A"
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ─── Lógica de estado del contrato ───────────────────────────────────────────
// La columna "is_extended" en Supabase (boolean) indica si el contrato está prorrogado.
// Si no tienes esa columna todavía, puedes agregarla luego y el componente ya la soporta.
function calculateContractStatus(endDate: string | null, isExtended?: boolean) {
  if (!endDate) return { label: "Sin fecha", color: "bg-slate-100 text-slate-600 border-slate-200" }

  if (isExtended) {
    return { label: "Prorrogado", color: "bg-purple-100 text-purple-700 border-purple-200" }
  }

  const end = new Date(endDate)
  const now = new Date()
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0)   return { label: "Expirado",              color: "bg-red-100 text-red-700 border-red-200" }
  if (diffDays <= 20) return { label: `Vence en ${diffDays} días`, color: "bg-orange-100 text-orange-700 border-orange-200 animate-pulse" }
  if (diffDays <= 60) return { label: `Vence en ${diffDays} días`, color: "bg-amber-100 text-amber-700 border-amber-200" }

  return { label: "Vigente", color: "bg-emerald-100 text-emerald-700 border-emerald-200" }
}

export function TenantList() {
  const [tenants, setTenants] = useState<any[]>([])

  async function fetchTenants() {
    const { data } = await supabase
      .from("tenants")
      .select("*, properties(id, name)")
      .order("full_name")
    if (data) setTenants(data)
  }

  useEffect(() => { fetchTenants() }, [])

  const openWhatsApp = (phone: string, name: string, property: string) => {
    if (!phone) { alert("No hay teléfono registrado para este inquilino."); return }
    const cleanPhone = phone.replace(/\D/g, "")
    const message = encodeURIComponent(`Hola ${name}, te escribo desde la administración de tu piso en ${property || "el inmueble"}. `)
    window.open(`https://wa.me/34${cleanPhone}?text=${message}`, "_blank")
  }

  async function handleDelete(id: number, name: string) {
    if (window.confirm(`🚨 ¿Eliminar el expediente de ${name}?`)) {
      const { error } = await supabase.from("tenants").delete().eq("id", id)
      if (!error) fetchTenants()
      else alert("Error al eliminar: " + error.message)
    }
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-blue-600" />
          Cartera de Inquilinos y Contratos
        </h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {/* COLUMNA INQUILINO: nombre + teléfono + EMAIL */}
            <TableHead>Inquilino</TableHead>
            <TableHead>Inmueble</TableHead>
            {/* FECHAS en formato español */}
            <TableHead>Inicio</TableHead>
            <TableHead>Fin</TableHead>
            {/* ESTADO: Vigente / Expirado / Vence en X días / Prorrogado */}
            <TableHead>Estado contrato</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {tenants.map((t) => {
            const status = calculateContractStatus(t.contract_end, t.is_extended)

            return (
              <TableRow key={t.id} className="hover:bg-slate-50">
                {/* Nombre + Teléfono + EMAIL */}
                <TableCell>
                  <p className="font-bold text-slate-700">{t.full_name}</p>
                  <p className="text-xs text-slate-400">{t.phone || "Sin teléfono"}</p>
                  {/* EMAIL del inquilino */}
                  {t.email && (
                    <a
                      href={`mailto:${t.email}`}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      {t.email}
                    </a>
                  )}
                  {!t.email && (
                    <p className="text-xs text-slate-300 italic">Sin email</p>
                  )}
                </TableCell>

                <TableCell className="font-medium text-slate-600">
                  {t.properties?.name || <span className="text-slate-400 italic text-xs">Sin asignar</span>}
                </TableCell>

                {/* FECHA INICIO — formato dd/mm/aaaa */}
                <TableCell className="text-sm text-slate-600">
                  {formatDateES(t.contract_start)}
                </TableCell>

                {/* FECHA FIN — formato dd/mm/aaaa */}
                <TableCell className="text-sm text-slate-600">
                  {formatDateES(t.contract_end)}
                </TableCell>

                {/* ESTADO del contrato */}
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] font-bold ${status.color}`}>
                    {status.label}
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    {t.document_url && (
                      <a
                        href={t.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-blue-100 rounded-full transition-colors text-blue-600"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    )}

                    <EditTenantForm tenant={t} onUpdate={fetchTenants} />

                    <button
                      onClick={() => handleDelete(t.id, t.full_name)}
                      className="p-2 hover:bg-red-50 rounded-full transition-colors text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => openWhatsApp(t.phone, t.full_name, t.properties?.name)}
                      className="inline-flex items-center justify-center p-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full transition-colors shadow-sm"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
