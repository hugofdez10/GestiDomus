"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileSignature, UploadCloud } from "lucide-react"

function buildContractCode() {
  const year = new Date().getFullYear()
  const suffix = Date.now().toString().slice(-6)
  return `CTR-${year}-${suffix}`
}

export function AddContractForm({
  onCreated,
  triggerClassName = "",
}: {
  onCreated: () => void
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])

  const [formData, setFormData] = useState({
    property_id: "",
    tenant_id: "",
    start_date: "",
    end_date: "",
    monthly_rent: "",
    deposit_amount: "",
    contract_status: "active",
    deposit_status: "pending",
    notes: "",
  })

  useEffect(() => {
    if (!open) return

    async function fetchOptions() {
      const [propertiesRes, tenantsRes] = await Promise.all([
        supabase.from("properties").select("id, name, price").order("name"),
        supabase.from("tenants").select("id, full_name, property_id").order("full_name"),
      ])

      if (propertiesRes.data) setProperties(propertiesRes.data)
      if (tenantsRes.data) setTenants(tenantsRes.data)
    }

    fetchOptions()
  }, [open])

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id.toString() === formData.property_id),
    [properties, formData.property_id]
  )

  const filteredTenants = useMemo(() => {
    if (!formData.property_id) return tenants
    return tenants.filter((tenant) => !tenant.property_id || tenant.property_id.toString() === formData.property_id)
  }, [tenants, formData.property_id])

  useEffect(() => {
    if (selectedProperty && !formData.monthly_rent) {
      setFormData((prev) => ({ ...prev, monthly_rent: String(selectedProperty.price || "") }))
    }
  }, [selectedProperty, formData.monthly_rent])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.property_id || !formData.tenant_id) {
      alert("Selecciona un inmueble y un inquilino.")
      return
    }

    setLoading(true)
    let documentPath: string | null = null

    try {
      if (file) {
        const fileExt = file.name.split(".").pop()
        const fileName = `contrato-${Date.now()}.${fileExt}`
        const filePath = `contratos/${fileName}`

        const { error: uploadError } = await supabase.storage.from("vault").upload(filePath, file)
        if (uploadError) throw uploadError

        const { data } = supabase.storage.from("vault").getPublicUrl(filePath)
        documentPath = data.publicUrl
      }

      const propertyId = parseInt(formData.property_id)
      const tenantId = parseInt(formData.tenant_id)

      const { error } = await supabase.from("contracts").insert([
        {
          property_id: propertyId,
          tenant_id: tenantId,
          contract_code: buildContractCode(),
          start_date: formData.start_date,
          end_date: formData.end_date,
          monthly_rent: parseFloat(formData.monthly_rent || "0"),
          deposit_amount: parseFloat(formData.deposit_amount || "0"),
          contract_status: formData.contract_status,
          deposit_status: formData.deposit_status,
          document_path: documentPath,
          notes: formData.notes || null,
          deposit_returned_amount: 0,
        },
      ])

      if (error) throw error

      await Promise.all([
        supabase.from("tenants").update({ property_id: propertyId }).eq("id", tenantId),
        supabase.from("properties").update({ status: "Alquilado" }).eq("id", propertyId),
      ])

      setOpen(false)
      setFile(null)
      setFormData({
        property_id: "",
        tenant_id: "",
        start_date: "",
        end_date: "",
        monthly_rent: "",
        deposit_amount: "",
        contract_status: "active",
        deposit_status: "pending",
        notes: "",
      })
      onCreated()
    } catch (error: any) {
      alert("❌ Error al crear el contrato: " + (error?.message || "Sin detalle"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={`bg-indigo-600 hover:bg-indigo-700 text-white gap-2 ${triggerClassName}`}>
          <FileSignature className="w-4 h-4" /> Nuevo Contrato
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-white sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Crear Contrato</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Inmueble</Label>
              <Select value={formData.property_id} onValueChange={(value) => setFormData({ ...formData, property_id: value, tenant_id: "", monthly_rent: "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un inmueble" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id.toString()}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Inquilino</Label>
              <Select value={formData.tenant_id} onValueChange={(value) => setFormData({ ...formData, tenant_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un inquilino" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {filteredTenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Inicio de contrato</Label>
              <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>Fin de contrato</Label>
              <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Renta mensual (€)</Label>
              <Input type="number" step="0.01" value={formData.monthly_rent} onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>Fianza (€)</Label>
              <Input type="number" step="0.01" value={formData.deposit_amount} onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Estado del contrato</Label>
              <Select value={formData.contract_status} onValueChange={(value) => setFormData({ ...formData, contract_status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="signed">Firmado</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="expired">Vencido</SelectItem>
                  <SelectItem value="terminated">Rescindido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Estado de fianza</Label>
              <Select value={formData.deposit_status} onValueChange={(value) => setFormData({ ...formData, deposit_status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="received">Recibida</SelectItem>
                  <SelectItem value="returned">Devuelta</SelectItem>
                  <SelectItem value="partially_returned">Devuelta parcial</SelectItem>
                  <SelectItem value="withheld">Retenida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Notas</Label>
            <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Observaciones, cláusulas o contexto" />
          </div>

          <div className="grid gap-2 pt-4 border-t mt-2">
            <Label className="flex items-center gap-2 text-indigo-600 font-bold">
              <UploadCloud className="w-4 h-4" /> Adjuntar contrato firmado
            </Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded-md file:px-3 file:py-1.5 cursor-pointer hover:file:bg-indigo-100 transition-colors"
            />
          </div>

          <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white mt-2 w-full">
            {loading ? "Guardando contrato..." : "Crear Contrato"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
