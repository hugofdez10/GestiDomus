"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UploadCloud, UserPlus } from "lucide-react"

export function AddTenantForm({
  properties,
  triggerClassName = "",
}: {
  properties?: any[]
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [propertiesList, setPropertiesList] = useState<any[]>(properties || [])

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    property_id: "none",
  })

  useEffect(() => {
    if (!open) return

    async function fetchProperties() {
      const { data } = await supabase.from("properties").select("id, name").order("name")
      if (data) setPropertiesList(data)
    }

    fetchProperties()
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    let finalDocumentUrl: string | null = null

    if (file) {
      const fileExt = file.name.split(".").pop()
      const fileName = `inquilino-${Date.now()}.${fileExt}`
      const filePath = `inquilinos/${fileName}`

      const { error: uploadError } = await supabase.storage.from("vault").upload(filePath, file)

      if (uploadError) {
        alert("Error al subir el documento: " + uploadError.message)
        setLoading(false)
        return
      }

      const { data } = supabase.storage.from("vault").getPublicUrl(filePath)
      finalDocumentUrl = data.publicUrl
    }

    const payload: any = {
      full_name: formData.full_name,
      email: formData.email || null,
      phone: formData.phone || null,
      document_url: finalDocumentUrl,
    }

    if (formData.property_id !== "none") {
      payload.property_id = parseInt(formData.property_id)
    }

    const { error } = await supabase.from("tenants").insert([payload])

    if (error) {
      alert("❌ Error al guardar el inquilino: " + error.message)
    } else {
      setOpen(false)
      setFile(null)
      window.location.reload()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={`bg-blue-600 hover:bg-blue-700 text-white gap-2 ${triggerClassName}`}>
          <UserPlus className="w-4 h-4" /> Nuevo Inquilino
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-white sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Inquilino</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nombre Completo</Label>
            <Input
              placeholder="Ej: Juan Pérez"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="juan@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input
                placeholder="600123456"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Asignar a Inmueble</Label>
            <Select
              value={formData.property_id}
              onValueChange={(value) => setFormData({ ...formData, property_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un inmueble..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="none">Sin asignar de momento</SelectItem>
                {propertiesList.map((property) => (
                  <SelectItem key={property.id} value={property.id.toString()}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 pt-4 border-t mt-2">
            <Label className="flex items-center gap-2 text-blue-600 font-bold">
              <UploadCloud className="w-4 h-4" /> Documento del inquilino
            </Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs file:bg-blue-50 file:text-blue-700 file:border-0 file:rounded-md file:px-3 file:py-1.5 cursor-pointer hover:file:bg-blue-100 transition-colors"
            />
            <p className="text-[10px] text-slate-500">Puedes subir un DNI, autorización o ficha del inquilino.</p>
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white mt-4 w-full">
            {loading ? "Guardando..." : "Crear Inquilino"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
