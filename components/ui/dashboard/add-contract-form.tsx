"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileSignature, UploadCloud } from "lucide-react"

type ContractStatus =
  | "borrador"
  | "pendiente_firma"
  | "activo"
  | "vencido"
  | "rescindido"
  | "prorrogado"

type DepositStatus =
  | "pendiente"
  | "parcial"
  | "devuelta"
  | "retenida"

type PropertyOption = {
  id: number
  name: string
  price?: number | null
}

type TenantOption = {
  id: number
  full_name: string
}

type FormDataState = {
  property_id: string
  tenant_id: string
  start_date: string
  end_date: string
  monthly_rent: string
  deposit_amount: string
  contract_status: ContractStatus
  deposit_status: DepositStatus
  notes: string
}

const INITIAL_FORM: FormDataState = {
  property_id: "",
  tenant_id: "",
  start_date: "",
  end_date: "",
  monthly_rent: "",
  deposit_amount: "",
  contract_status: "activo",
  deposit_status: "pendiente",
  notes: "",
}

const CONTRACT_STATUS_TO_DB: Record<ContractStatus, string> = {
  borrador: "draft",
  pendiente_firma: "sent",
  activo: "active",
  vencido: "expired",
  rescindido: "terminated",
  prorrogado: "renewed",
}

const CONTRACT_STATUS_TO_DB_LEGACY: Record<ContractStatus, string> = {
  borrador: "borrador",
  pendiente_firma: "pendiente_firma",
  activo: "activo",
  vencido: "vencido",
  rescindido: "rescindido",
  prorrogado: "activo", // fallback legacy seguro
}

const DEPOSIT_STATUS_TO_DB: Record<DepositStatus, string> = {
  pendiente: "pending",
  parcial: "partially_returned",
  devuelta: "returned",
  retenida: "withheld",
}

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
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [formData, setFormData] = useState<FormDataState>(INITIAL_FORM)

  useEffect(() => {
    if (!open) return

    async function fetchOptions() {
      const [propertiesRes, tenantsRes] = await Promise.all([
        supabase.from("properties").select("id, name, price").order("name"),
        supabase.from("tenants").select("id, full_name").order("full_name"),
      ])

      if (propertiesRes.error) {
        alert("Error cargando inmuebles: " + propertiesRes.error.message)
        return
      }

      if (tenantsRes.error) {
        alert("Error cargando inquilinos: " + tenantsRes.error.message)
        return
      }

      setProperties((propertiesRes.data ?? []) as PropertyOption[])
      setTenants((tenantsRes.data ?? []) as TenantOption[])
    }

    fetchOptions()
  }, [open])

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id.toString() === formData.property_id),
    [properties, formData.property_id]
  )

  const filteredTenants = useMemo(() => tenants, [tenants])

  useEffect(() => {
    if (selectedProperty && !formData.monthly_rent) {
      setFormData((prev) => ({
        ...prev,
        monthly_rent: String(selectedProperty.price ?? ""),
      }))
    }
  }, [selectedProperty, formData.monthly_rent])

  function resetForm() {
    setFormData(INITIAL_FORM)
    setFile(null)
  }

  async function uploadContractPdf(fileToUpload: File) {
    const extension = fileToUpload.name.split(".").pop()?.toLowerCase()

    if (extension !== "pdf") {
      throw new Error("Solo se permite adjuntar archivos PDF.")
    }

    const fileName = `contrato-${Date.now()}.pdf`
    const filePath = `contratos/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from("vault")
      .upload(filePath, fileToUpload, {
        upsert: false,
        contentType: "application/pdf",
      })

    if (uploadError) throw uploadError

    return filePath
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.property_id || !formData.tenant_id) {
      alert("Selecciona un inmueble y un inquilino.")
      return
    }

    if (!formData.start_date || !formData.end_date) {
      alert("Debes indicar fecha de inicio y fecha de fin.")
      return
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      alert("La fecha de fin no puede ser anterior a la fecha de inicio.")
      return
    }

    setLoading(true)

    try {
      let documentPath: string | null = null

      if (file) {
        documentPath = await uploadContractPdf(file)
      }

      const propertyId = Number(formData.property_id)
      const tenantId = Number(formData.tenant_id)


const payload = {
  property_id: propertyId,
  tenant_id: tenantId,
  contract_code: buildContractCode(),
  start_date: formData.start_date,
  end_date: formData.end_date,
  monthly_rent: Number(formData.monthly_rent || 0),
  deposit_amount: Number(formData.deposit_amount || 0),
  deposit_returned_amount: 0,
  contract_status: CONTRACT_STATUS_TO_DB[formData.contract_status] ?? "active",
  deposit_status: DEPOSIT_STATUS_TO_DB[formData.deposit_status] ?? "pending",
  document_path: documentPath,
  notes: formData.notes || null,
}

const { error: insertError } = await supabase.from("contracts").insert([payload])

if (insertError) throw insertError

      const { error: propertyError } = await supabase
        .from("properties")
        .update({ status: "occupied" })
        .eq("id", propertyId)

      if (propertyError) throw propertyError

      setOpen(false)
      resetForm()
      onCreated()
    } catch (error: any) {
      alert("❌ Error al crear el contrato: " + (error?.message || "Sin detalle"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button className={`bg-indigo-600 hover:bg-indigo-700 text-white gap-2 ${triggerClassName}`}>
          <FileSignature className="w-4 h-4" />
          Nuevo Contrato
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
              <Select
                value={formData.property_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, property_id: value, monthly_rent: "" }))
                }
              >
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
              <Select
                value={formData.tenant_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, tenant_id: value }))}
              >
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
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Fin de contrato</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Renta mensual (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_rent}
                onChange={(e) => setFormData((prev) => ({ ...prev, monthly_rent: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Fianza (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.deposit_amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, deposit_amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Estado del contrato</Label>
              <Select
                value={formData.contract_status}
                onValueChange={(value: ContractStatus) =>
                  setFormData((prev) => ({ ...prev, contract_status: value }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="pendiente_firma">Pendiente firma</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="rescindido">Rescindido</SelectItem>
                  <SelectItem value="prorrogado">Prorrogado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Estado de fianza</Label>
              <Select
                value={formData.deposit_status}
                onValueChange={(value: DepositStatus) =>
                  setFormData((prev) => ({ ...prev, deposit_status: value }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="parcial">Devuelta parcial</SelectItem>
                  <SelectItem value="devuelta">Fianza devuelta</SelectItem>
                  <SelectItem value="retenida">Fianza retenida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Notas</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Observaciones, cláusulas o contexto"
            />
          </div>

          <div className="grid gap-2 pt-4 border-t mt-2">
            <Label className="flex items-center gap-2 text-indigo-600 font-bold">
              <UploadCloud className="w-4 h-4" />
              Adjuntar contrato firmado (PDF)
            </Label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded-md file:px-3 file:py-1.5 cursor-pointer hover:file:bg-indigo-100 transition-colors"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white mt-2 w-full"
          >
            {loading ? "Guardando contrato..." : "Crear Contrato"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
