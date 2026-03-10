"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, UploadCloud } from "lucide-react"

export function AddTenantForm({ properties }: { properties?: any[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  // Lista inteligente de inmuebles
  const [propertiesList, setPropertiesList] = useState<any[]>(properties || [])
  
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    property_id: "none",
    contract_start: "",
    contract_end: "",
    deposit_amount: ""
  })

  // Cargar inmuebles automáticamente al abrir la ventana
  useEffect(() => {
    if (open) {
      async function fetchProperties() {
        const { data } = await supabase.from('properties').select('id, name')
        if (data) setPropertiesList(data)
      }
      fetchProperties()
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    let finalDocumentUrl = null

    // 1. Subir el contrato/DNI a la Bóveda si se ha seleccionado uno
    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `inquilino-nuevo-${Date.now()}.${fileExt}`
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

    // 2. Preparar los datos del inquilino
    const newTenant: any = {
      full_name: formData.full_name,
      phone: formData.phone,
      contract_start: formData.contract_start || null,
      contract_end: formData.contract_end || null,
      deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : 0,
      document_url: finalDocumentUrl
    }

    // Asignar piso si se ha seleccionado uno
    if (formData.property_id !== "none") {
      newTenant.property_id = parseInt(formData.property_id)
    }

    // 3. Guardar en Supabase
    const { error } = await supabase.from('tenants').insert([newTenant])

    if (error) {
      alert("❌ Error al guardar el inquilino: " + error.message)
    } else {
      setOpen(false)
      setFile(null)
      // Recargar para que aparezca en la lista
      window.location.reload()
    }
    
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <UserPlus className="w-4 h-4" /> Nuevo Inquilino
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Inquilino</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          <div className="grid gap-2">
            <Label>Nombre Completo</Label>
            <Input 
              placeholder="Ej: Juan Pérez" 
              value={formData.full_name} 
              onChange={(e) => setFormData({...formData, full_name: e.target.value})} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input 
                placeholder="Ej: 600123456" 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label>Fianza Retenida (€)</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00"
                value={formData.deposit_amount} 
                onChange={(e) => setFormData({...formData, deposit_amount: e.target.value})} 
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Asignar a Inmueble</Label>
            <Select 
              value={formData.property_id} 
              onValueChange={(val) => setFormData({...formData, property_id: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un inmueble..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="none">Sin asignar de momento</SelectItem>
                {propertiesList.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Inicio Contrato</Label>
              <Input 
                type="date" 
                value={formData.contract_start} 
                onChange={(e) => setFormData({...formData, contract_start: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label>Fin Contrato</Label>
              <Input 
                type="date" 
                value={formData.contract_end} 
                onChange={(e) => setFormData({...formData, contract_end: e.target.value})} 
              />
            </div>
          </div>

          {/* ZONA DE SUBIDA DE DOCUMENTOS DIRECTA */}
          <div className="grid gap-2 pt-4 border-t mt-2">
            <Label className="flex items-center gap-2 text-blue-600 font-bold">
              <UploadCloud className="w-4 h-4" /> Adjuntar Contrato / DNI
            </Label>
            <Input 
              type="file" 
              accept="image/*,.pdf" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
              className="text-xs file:bg-blue-50 file:text-blue-700 file:border-0 file:rounded-md file:px-3 file:py-1.5 cursor-pointer hover:file:bg-blue-100 transition-colors" 
            />
            <p className="text-[10px] text-slate-500">Puedes subir un PDF con todo el contrato o una foto del DNI.</p>
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white mt-4 w-full">
            {loading ? "Guardando y subiendo archivo..." : "Crear Inquilino"}
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  )
}