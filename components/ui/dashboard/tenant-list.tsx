"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, FileSignature, Trash2, FileText } from "lucide-react"
import { EditTenantForm } from "./edit-tenant-form"

export function TenantList() {
  const [tenants, setTenants] = useState<any[]>([])

  async function fetchTenants() {
    const { data } = await supabase.from("tenants").select("*, properties(id, name)").order("full_name")
    if (data) setTenants(data)
  }

  useEffect(() => {
    fetchTenants()
  }, [])

  const calculateStatus = (endDate: string) => {
    if (!endDate) return { label: "Sin fecha", color: "bg-slate-100 text-slate-600" }

    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { label: "Expirado", color: "bg-red-100 text-red-700 border-red-200" }
    if (diffDays <= 60) return { label: `Vence en ${diffDays} días`, color: "bg-orange-100 text-orange-700 border-orange-200" }

    return { label: "Vigente", color: "bg-emerald-100 text-emerald-700 border-emerald-200" }
  }

  const openWhatsApp = (phone: string, name: string, property: string) => {
    if (!phone) {
      alert("No hay teléfono registrado para este inquilino.")
      return
    }

    const cleanPhone = phone.replace(/\D/g, "")
    const message = encodeURIComponent(`Hola ${name}, te escribo desde la administración de tu piso en ${property || "el inmueble"}. `)
    window.open(`https://wa.me/34${cleanPhone}?text=${message}`, "_blank")
  }

  async function handleDelete(id: number, name: string) {
    if (window.confirm(`🚨 ¿Eliminar el expediente de ${name}?`)) {
      const { error } = await supabase.from("tenants").delete().eq("id", id)

      if (!error) {
        fetchTenants()
      } else {
        alert("Error al eliminar: " + error.message)
      }
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
            <TableHead>Inquilino</TableHead>
            <TableHead>Inmueble</TableHead>
            <TableHead>Fin de Contrato</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {tenants.map((t) => {
            const status = calculateStatus(t.contract_end)

            return (
              <TableRow key={t.id} className="hover:bg-slate-50">
                <TableCell>
                  <p className="font-bold text-slate-700">{t.full_name}</p>
                  <p className="text-xs text-slate-400">{t.phone || "Sin teléfono"}</p>
                </TableCell>

                <TableCell className="font-medium text-slate-600">
                  {t.properties?.name || <span className="text-slate-400 italic text-xs">Sin asignar</span>}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm">{t.contract_end || "N/A"}</span>
                    <Badge variant="outline" className={`text-[10px] ${status.color}`}>
                      {status.label}
                    </Badge>
                  </div>
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