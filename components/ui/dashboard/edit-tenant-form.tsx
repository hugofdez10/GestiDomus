"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ExternalLink, Pencil, UploadCloud } from "lucide-react"
import { getStorageDisplayUrl } from "@/lib/storage"

export function EditTenantForm({ tenant, onUpdate }: { tenant: any; onUpdate: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [currentDocumentUrl, setCurrentDocumentUrl] = useState<string | null>(null)
  const [propertiesList, setPropertiesList] = useState<any[]>([])

  const [formData, setFormData] = useState({
    full_name: tenant.full_name || "",
    email: tenant.email || "",
    phone: tenant.phone || "",
    property_id: tenant.property_id ? tenant.property_id.toString() : "none",
  })

  useEffect(() => {
    if (!open) return

    setFormData({
      full_name: tenant.full_name || "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      property_id: tenant.property_id ? tenant.property_id.toString() : "none",
    })
    setFile(null)
    setCurrentDocumentUrl(null)

    if (tenant.document_url) {
      getStorageDisplayUrl(supabase, "vault", tenant.document_url)
        .then(setCurrentDocumentUrl)
        .catch(() => setCurrentDocumentUrl(null))
    }

    async function fetchProperties() {
      const { data } = await supabase.from("properties").select("id, name").order("name")
      if (data) setPropertiesList(data)
    }

    fetchProperties()
  }, [open, tenant])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    let finalDocumentUrl = tenant.document_url || null

    if (file) {
      const fileExt = file.name.split(".").pop()
      const fileName = `inquilino-${tenant.id}-${Date.now()}.${fileExt}`
      const filePath = `inquilinos/${fileName}`

      const { error: uploadError } = await supabase.storage.from("vault").upload(filePath, file)

      if (uploadError) {
        alert("Error al subir el documento: " + uploadError.message)
        setLoading(false)
        return
      }

      finalDocumentUrl = filePath
    }

    const payload: any = {
      full_name: formData.full_name,
      email: formData.email || null,
      phone: formData.phone || null,
      property_id: formData.property_id === "none" ? null : parseInt(formData.property_id),
      document_url: finalDocumentUrl,
    }

    const { error } = await supabase.from("tenants").update(payload).eq("id", tenant.id)

    if (error) {
      alert("❌ Error al actualizar: " + error.message)
    } else {
      setOpen(false)
      onUpdate()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-blue-600">
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="bg-white sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Editar Inquilino</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nombre Completo</Label>
            <Input
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
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Inmueble</Label>
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

          {tenant.document_url && currentDocumentUrl && (
            <a
              href={currentDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 font-semibold hover:underline"
            >
              <ExternalLink className="w-4 h-4" /> Ver documento actual
            </a>
          )}

          <div className="grid gap-2">
            <Label className="flex items-center gap-2 text-blue-600 font-bold">
              <UploadCloud className="w-4 h-4" /> Sustituir documento
            </Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs file:bg-blue-50 file:text-blue-700 file:border-0 file:rounded-md file:px-3 file:py-1.5 cursor-pointer hover:file:bg-blue-100 transition-colors"
            />
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white mt-2 w-full">
            {loading ? "Guardando..." : "Actualizar Inquilino"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
