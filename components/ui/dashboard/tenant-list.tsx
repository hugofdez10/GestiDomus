"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, MessageCircle, Trash2, Users } from "lucide-react"
import { EditTenantForm } from "./edit-tenant-form"

export function TenantList() {
  const [tenants, setTenants] = useState<any[]>([])

  async function fetchTenants() {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, full_name, email, phone, property_id, document_url, properties(name)")
      .order("full_name")

    if (!error && data) setTenants(data)
  }

  useEffect(() => {
    fetchTenants()
  }, [])

  const openWhatsApp = (phone: string, name: string, property: string) => {
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
      fetchTenants()
      return
    }

    if ((error as any).code === "23503") {
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
          {tenants.map((tenant) => (
            <TableRow key={tenant.id} className="hover:bg-slate-50">
              <TableCell>
                <p className="font-bold text-slate-700">{tenant.full_name}</p>
                <p className="text-xs text-slate-400">ID #{tenant.id}</p>
              </TableCell>

              <TableCell>
                <p className="text-sm text-slate-700">{tenant.email || "Sin email"}</p>
                <p className="text-xs text-slate-400">{tenant.phone || "Sin teléfono"}</p>
              </TableCell>

              <TableCell className="font-medium text-slate-600">
                {tenant.properties?.name || <span className="text-slate-400 italic text-xs">Sin asignar</span>}
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

                  <EditTenantForm tenant={tenant} onUpdate={fetchTenants} />

                  <button
                    onClick={() => handleDelete(tenant.id, tenant.full_name)}
                    className="p-2 hover:bg-red-50 rounded-full transition-colors text-slate-400 hover:text-red-600"
                    title="Eliminar inquilino"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => openWhatsApp(tenant.phone, tenant.full_name, tenant.properties?.name)}
                    className="inline-flex items-center justify-center p-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full transition-colors shadow-sm"
                    title="Enviar WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}