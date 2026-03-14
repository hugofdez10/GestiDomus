"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Home, Zap, Info } from "lucide-react"

export function AddPropertyForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    status: "occupied",
    price: "",
    purchase_price: "",
    construction_value: "",
    // ─── Ficha técnica ────────────────────────────
    cadastral_ref: "",      // Referencia catastral
    area_m2: "",            // Metros cuadrados
    bedrooms: "",           // Habitaciones
    bathrooms: "",          // Baños
    max_occupants: "",      // Máximo de personas
    // ─── Suministros ─────────────────────────────
    supply_electricity_company:  "",   // Empresa luz
    supply_electricity_contract: "",   // Nº contrato luz
    supply_gas_company:          "",   // Empresa gas
    supply_gas_contract:         "",   // Nº contrato gas
    supply_water_company:        "",   // Empresa agua
    supply_water_contract:       "",   // Nº contrato agua
    supply_internet_company:     "",   // Empresa internet
    supply_internet_contract:    "",   // Nº contrato internet
  })

  function setField(key: string, value: string) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) { alert("El nombre del inmueble es obligatorio."); return }

    setLoading(true)

    // Construimos el objeto JSON de suministros para guardarlo en un campo JSONB
    const supplies = {
      electricity: { company: formData.supply_electricity_company, contract: formData.supply_electricity_contract },
      gas:         { company: formData.supply_gas_company,         contract: formData.supply_gas_contract },
      water:       { company: formData.supply_water_company,       contract: formData.supply_water_contract },
      internet:    { company: formData.supply_internet_company,    contract: formData.supply_internet_contract },
    }

    const payload: any = {
      name:               formData.name,
      status:             formData.status,
      price:              parseFloat(formData.price)              || null,
      purchase_price:     parseFloat(formData.purchase_price)     || null,
      construction_value: parseFloat(formData.construction_value) || null,
      // Ficha técnica
      cadastral_ref:  formData.cadastral_ref  || null,
      area_m2:        parseFloat(formData.area_m2)        || null,
      bedrooms:       parseInt(formData.bedrooms)         || null,
      bathrooms:      parseInt(formData.bathrooms)        || null,
      max_occupants:  parseInt(formData.max_occupants)    || null,
      // Suministros como JSONB
      supplies: supplies,
    }

    const { error } = await supabase.from("properties").insert([payload])
    if (error) {
      alert("❌ Error al guardar: " + error.message)
    } else {
      setOpen(false)
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-700 hover:bg-blue-800 text-white gap-2 shadow-sm font-bold">
          <Plus className="w-4 h-4" /> Añadir Inmueble
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" /> Nuevo Inmueble
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 py-2">

          {/* ── DATOS BÁSICOS ───────────────────────────────── */}
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Datos básicos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label>Nombre del inmueble *</Label>
                <Input placeholder="Ej: Piso calle Mayor 3-1º" value={formData.name}
                  onChange={(e) => setField("name", e.target.value)} required />
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
                <Input type="number" step="0.01" placeholder="0.00" value={formData.price}
                  onChange={(e) => setField("price", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Precio de compra (€)</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={formData.purchase_price}
                  onChange={(e) => setField("purchase_price", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Valor de construcción (€)</Label>
                <Input type="number" step="0.01" placeholder="Para amortización 3%" value={formData.construction_value}
                  onChange={(e) => setField("construction_value", e.target.value)} />
              </div>
            </div>
          </section>

          {/* ── FICHA TÉCNICA ───────────────────────────────── */}
          <section className="p-4 bg-slate-50 rounded-xl border">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" /> Ficha técnica del inmueble
            </h3>
            <div className="grid grid-cols-2 gap-3">

              <div className="col-span-2 grid gap-2">
                <Label>Referencia catastral</Label>
                <Input placeholder="Ej: 9872023VH5797S0001WX" value={formData.cadastral_ref}
                  onChange={(e) => setField("cadastral_ref", e.target.value)}
                  className="font-mono text-sm" />
              </div>

              <div className="grid gap-2">
                <Label>Superficie (m²)</Label>
                <Input type="number" step="0.1" placeholder="Ej: 75" value={formData.area_m2}
                  onChange={(e) => setField("area_m2", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Habitaciones</Label>
                <Input type="number" min="0" placeholder="Ej: 3" value={formData.bedrooms}
                  onChange={(e) => setField("bedrooms", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Baños</Label>
                <Input type="number" min="0" placeholder="Ej: 1" value={formData.bathrooms}
                  onChange={(e) => setField("bathrooms", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Máx. personas</Label>
                <Input type="number" min="1" placeholder="Ej: 4" value={formData.max_occupants}
                  onChange={(e) => setField("max_occupants", e.target.value)} />
              </div>
            </div>
          </section>

          {/* ── SUMINISTROS ────────────────────────────────── */}
          <section className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Suministros
            </h3>
            <p className="text-xs text-amber-600 mb-4">Anota la empresa comercializadora y el número de contrato de cada suministro.</p>

            {[
              { key: "electricity", label: "⚡ Electricidad" },
              { key: "gas",         label: "🔥 Gas" },
              { key: "water",       label: "💧 Agua" },
              { key: "internet",    label: "📡 Internet" },
            ].map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-amber-100 last:border-0 last:mb-0 last:pb-0">
                <div className="col-span-2">
                  <p className="text-sm font-bold text-slate-700">{label}</p>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Empresa</Label>
                  <Input placeholder="Nombre empresa" value={(formData as any)[`supply_${key}_company`]}
                    onChange={(e) => setField(`supply_${key}_company`, e.target.value)}
                    className="bg-white text-sm" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Nº Contrato / CUPS</Label>
                  <Input placeholder="Número contrato" value={(formData as any)[`supply_${key}_contract`]}
                    onChange={(e) => setField(`supply_${key}_contract`, e.target.value)}
                    className="bg-white text-sm" />
                </div>
              </div>
            ))}
          </section>

          <Button type="submit" disabled={loading} className="bg-blue-700 hover:bg-blue-800 text-white mt-2 w-full">
            {loading ? "Guardando..." : "Añadir Inmueble"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
