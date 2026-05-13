"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Landmark, Mail, Pencil, ShieldCheck, Zap } from "lucide-react"

type PropertyFormData = {
  name: string
  address: string
  status: string
  price: string
  purchase_price: string
  construction_value: string
  payment_account_holder: string
  payment_account_iban: string
  sender_email: string
  insurance_company: string
  insurance_policy_number: string
  cadastral_ref: string
  area_m2: string
  bedrooms: string
  bathrooms: string
  max_occupants: string
  supply_electricity_company: string
  supply_electricity_contract: string
  supply_gas_company: string
  supply_gas_contract: string
  supply_water_company: string
  supply_water_contract: string
  supply_internet_company: string
  supply_internet_contract: string
}

type SupplyInfo = {
  company?: string | null
  contract?: string | null
}

type PropertyRecord = {
  id: number
  name?: string | null
  address?: string | null
  status?: string | null
  price?: number | string | null
  purchase_price?: number | string | null
  construction_value?: number | string | null
  payment_account_holder?: string | null
  payment_account_iban?: string | null
  sender_email?: string | null
  insurance_company?: string | null
  insurance_policy_number?: string | null
  cadastral_ref?: string | null
  area_m2?: number | string | null
  bedrooms?: number | string | null
  bathrooms?: number | string | null
  max_occupants?: number | string | null
  supplies?: Record<string, SupplyInfo | undefined> | null
}

type EditPropertyFormProps = {
  property: PropertyRecord
  onUpdate: () => void
}

function asString(value: unknown) {
  return value == null ? "" : String(value)
}

function getInitialFormData(property: PropertyRecord): PropertyFormData {
  const supplies = property.supplies || {}

  return {
    name: property.name || "",
    address: property.address || "",
    status: property.status || "occupied",
    price: asString(property.price),
    purchase_price: asString(property.purchase_price),
    construction_value: asString(property.construction_value),
    payment_account_holder: property.payment_account_holder || "",
    payment_account_iban: property.payment_account_iban || "",
    sender_email: property.sender_email || "",
    insurance_company: property.insurance_company || "",
    insurance_policy_number: property.insurance_policy_number || "",
    cadastral_ref: property.cadastral_ref || "",
    area_m2: asString(property.area_m2),
    bedrooms: asString(property.bedrooms),
    bathrooms: asString(property.bathrooms),
    max_occupants: asString(property.max_occupants),
    supply_electricity_company: supplies.electricity?.company || "",
    supply_electricity_contract: supplies.electricity?.contract || "",
    supply_gas_company: supplies.gas?.company || "",
    supply_gas_contract: supplies.gas?.contract || "",
    supply_water_company: supplies.water?.company || "",
    supply_water_contract: supplies.water?.contract || "",
    supply_internet_company: supplies.internet?.company || "",
    supply_internet_contract: supplies.internet?.contract || "",
  }
}

export function EditPropertyForm({ property, onUpdate }: EditPropertyFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<PropertyFormData>(() => getInitialFormData(property))

  function setField(key: keyof PropertyFormData, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setFormData(getInitialFormData(property))
    setOpen(nextOpen)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supplies = {
      electricity: {
        company: formData.supply_electricity_company || null,
        contract: formData.supply_electricity_contract || null,
      },
      gas: {
        company: formData.supply_gas_company || null,
        contract: formData.supply_gas_contract || null,
      },
      water: {
        company: formData.supply_water_company || null,
        contract: formData.supply_water_contract || null,
      },
      internet: {
        company: formData.supply_internet_company || null,
        contract: formData.supply_internet_contract || null,
      },
    }

    const { data, error } = await supabase
      .from("properties")
      .update({
        name: formData.name,
        address: formData.address || null,
        status: formData.status,
        price: parseFloat(formData.price) || null,
        purchase_price: parseFloat(formData.purchase_price) || null,
        construction_value: parseFloat(formData.construction_value) || null,
        payment_account_holder: formData.payment_account_holder || null,
        payment_account_iban: formData.payment_account_iban || null,
        sender_email: formData.sender_email || null,
        insurance_company: formData.insurance_company || null,
        insurance_policy_number: formData.insurance_policy_number || null,
        cadastral_ref: formData.cadastral_ref || null,
        area_m2: parseFloat(formData.area_m2) || null,
        bedrooms: parseInt(formData.bedrooms) || null,
        bathrooms: parseInt(formData.bathrooms) || null,
        max_occupants: parseInt(formData.max_occupants) || null,
        supplies,
      })
      .eq("id", property.id)
      .select()

    if (error) {
      alert("Error de servidor: " + error.message)
    } else if (!data || data.length === 0) {
      alert("El sistema no pudo actualizar el piso. Verifica que no haya bloqueos de seguridad.")
    } else {
      setOpen(false)
      onUpdate()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500" title="Editar Activo">
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {property.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="grid gap-5 py-4">
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Datos básicos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 grid gap-2">
                <Label>Nombre del inmueble</Label>
                <Input value={formData.name} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div className="sm:col-span-2 grid gap-2">
                <Label>Dirección / calle</Label>
                <Input value={formData.address} onChange={(e) => setField("address", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select value={formData.status} onValueChange={(val) => setField("status", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="occupied">Ocupado</SelectItem>
                    <SelectItem value="vacant">Vacante</SelectItem>
                    <SelectItem value="maintenance">En obras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Renta mensual (€)</Label>
                <Input type="number" step="0.01" value={formData.price} onChange={(e) => setField("price", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Precio compra (€)</Label>
                <Input type="number" step="0.01" value={formData.purchase_price} onChange={(e) => setField("purchase_price", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Valor construcción (€)</Label>
                <Input type="number" step="0.01" value={formData.construction_value} onChange={(e) => setField("construction_value", e.target.value)} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700">
              <Landmark className="w-4 h-4" /> Datos fiscales y recibos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 grid gap-2">
                <Label>Referencia catastral</Label>
                <Input value={formData.cadastral_ref} onChange={(e) => setField("cadastral_ref", e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="grid gap-2">
                <Label>Superficie (m²)</Label>
                <Input type="number" step="0.1" value={formData.area_m2} onChange={(e) => setField("area_m2", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Máx. personas</Label>
                <Input type="number" min="1" value={formData.max_occupants} onChange={(e) => setField("max_occupants", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Habitaciones</Label>
                <Input type="number" min="0" value={formData.bedrooms} onChange={(e) => setField("bedrooms", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Baños</Label>
                <Input type="number" min="0" value={formData.bathrooms} onChange={(e) => setField("bathrooms", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Titular cuenta cobro</Label>
                <Input value={formData.payment_account_holder} onChange={(e) => setField("payment_account_holder", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>IBAN cobro</Label>
                <Input value={formData.payment_account_iban} onChange={(e) => setField("payment_account_iban", e.target.value)} />
              </div>
              <div className="sm:col-span-2 grid gap-2">
                <Label className="flex items-center gap-1"><Mail className="w-4 h-4" /> Email remitente por defecto</Label>
                <Input value={formData.sender_email} onChange={(e) => setField("sender_email", e.target.value)} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-700">
              <ShieldCheck className="w-4 h-4" /> Seguro
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Empresa</Label>
                <Input
                  value={formData.insurance_company}
                  onChange={(e) => setField("insurance_company", e.target.value)}
                  className="bg-white text-sm"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">N. de poliza</Label>
                <Input
                  value={formData.insurance_policy_number}
                  onChange={(e) => setField("insurance_policy_number", e.target.value)}
                  className="bg-white text-sm"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-700">
              <Zap className="w-4 h-4" /> Suministros
            </h3>
            {[
              { key: "electricity", label: "Electricidad" },
              { key: "gas", label: "Gas" },
              { key: "water", label: "Agua" },
              { key: "internet", label: "Internet" },
            ].map(({ key, label }) => (
              <div key={key} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 border-b border-amber-100 pb-3 last:mb-0 last:border-0 last:pb-0">
                <p className="sm:col-span-2 text-sm font-bold text-slate-700">{label}</p>
                <div className="grid gap-1">
                  <Label className="text-xs">Empresa</Label>
                  <Input
                    value={formData[`supply_${key}_company` as keyof PropertyFormData]}
                    onChange={(e) => setField(`supply_${key}_company` as keyof PropertyFormData, e.target.value)}
                    className="bg-white text-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Nº Contrato / CUPS</Label>
                  <Input
                    value={formData[`supply_${key}_contract` as keyof PropertyFormData]}
                    onChange={(e) => setField(`supply_${key}_contract` as keyof PropertyFormData, e.target.value)}
                    className="bg-white text-sm"
                  />
                </div>
              </div>
            ))}
          </section>

          <Button type="submit" disabled={loading} className="bg-blue-600 text-white mt-2">
            {loading ? "Guardando cambios..." : "Actualizar Inmueble"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
