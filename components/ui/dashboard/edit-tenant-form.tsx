"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Pencil, UploadCloud, ExternalLink } from "lucide-react"

export function EditTenantForm({ tenant, onUpdate }: { tenant: any, onUpdate: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  const [formData, setFormData] = useState({
    full_name: tenant.full_name || "",
    phone: tenant.phone || "",
    contract_start: tenant.contract_start || "",
    contract_end: tenant.contract_end || "",
    deposit_amount: tenant.deposit_amount || 0
  })

  useEffect(() => {
    if (open) {
      setFormData({
        full_name: tenant.full_name || "",
        phone: tenant.phone || "",
        contract_start: tenant.contract_start || "",
        contract_end: tenant.contract_end || "",
        deposit_amount: tenant.deposit_amount || 0
      })
      setFile(null)
    }
  }, [open, tenant])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    let finalDocumentUrl = tenant.document_url

    // Si hay un archivo nuevo, lo subimos a la Bóveda en la carpeta 'inquilinos'
    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `inquilino-${tenant.id}-${Date.now()}.${fileExt}`
      const filePath = `inquilinos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('vault')
        .upload(filePath, file)

      if (!uploadError) {
        const { data } = supabase.storage.from('vault').getPublicUrl(filePath)
        finalDocumentUrl = data.publicUrl
      } else {
        alert("Error al subir el documento: " + uploadError.message)
      }
    }

    const { error } = await supabase
      .from('tenants')
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
        contract_start: formData.contract_start,
        contract_end: formData.contract_end,
        deposit_amount: parseFloat(formData.deposit_amount.toString()),
        document_url: finalDocumentUrl
      })
      .eq('id', tenant.id)

    if (error) {
      alert("❌ Error al actualizar: " + error.message)
    } else {
      setOpen(false)
      onUpdate() // Refresca la tabla
    }
    
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500" title="Editar Inquilino">
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar {tenant.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nombre Completo</Label>
            <Input value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required />
          </div>
          <div className="grid gap-2">
            <Label>Teléfono</Label>
            <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Inicio Contrato</Label>
              <Input type="date" value={formData.contract_start} onChange={(e) => setFormData({...formData, contract_start: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Fin Contrato</Label>
              <Input type="date" value={formData.contract_end} onChange={(e) => setFormData({...formData, contract_end: e.target.value})} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Fianza Retenida (€)</Label>
            <Input type="number" step="0.01" value={formData.deposit_amount} onChange={(e) => setFormData({...formData, deposit_amount: e.target.value})} />
          </div>

          {/* ZONA DE SUBIDA DE DOCUMENTOS */}
          <div className="grid gap-2 pt-2 border-t mt-2">
            <Label className="flex items-center gap-2 text-blue-600 font-bold">
              <UploadCloud className="w-4 h-4" /> Adjuntar Contrato / DNI
            </Label>
            {tenant.document_url && !file && (
              <a href={tenant.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 flex items-center gap-1 mb-2 hover:underline">
                <ExternalLink className="w-3 h-3" /> Ver documento actual
              </a>
            )}
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs file:bg-blue-50 file:text-blue-700 file:border-0 file:rounded-md file:px-2 file:py-1 cursor-pointer" />
            <p className="text-[10px] text-slate-400">Puedes subir un PDF con todo el contrato o una foto del DNI.</p>
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 text-white mt-4">
            {loading ? "Guardando..." : "Actualizar Inquilino"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}