"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus } from "lucide-react"

// Opciones de duración del contrato en meses
const CONTRACT_DURATIONS = [
  { label: "6 meses",   value: 6 },
  { label: "11 meses",  value: 11 },
  { label: "12 meses (1 año)", value: 12 },
  { label: "24 meses (2 años)", value: 24 },
  { label: "36 meses (3 años)", value: 36 },
  { label: "60 meses (5 años)", value: 60 },
  { label: "Personalizado", value: 0 },
]

export function AddTenantForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [durationMonths, setDurationMonths] = useState<string>("12")
  const [customDuration, setCustomDuration] = useState<string>("")

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",           // ← NUEVO: email del inquilino
    property_id: "",
    contract_start: new Date().toISOString().split("T")[0],
    contract_end: "",
  })

  useEffect(() => {
    if (open) {
      supabase.from("properties").select("id, name").order("name").then(({ data }) => {
        if (data) setProperties(data)
      })
    }
  }, [open])

  // Calcula la fecha fin automáticamente al cambiar inicio o duración
  useEffect(() => {
    if (!formData.contract_start) return
    const months = durationMonths === "0" ? parseInt(customDuration) : parseInt(durationMonths)
    if (!months || isNaN(months)) return

    const start = new Date(formData.contract_start)
    start.setMonth(start.getMonth() + months)
    setFormData(prev => ({
      ...prev,
      contract_end: start.toISOString().split("T")[0]
    }))
  }, [formData.contract_start, durationMonths, customDuration])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.full_name.trim()) { alert("El nombre es obligatorio."); return }

    setLoading(true)
    const payload: any = {
      full_name: formData.full_name,
      phone: formData.phone || null,
      email: formData.email || null,       // ← NUEVO
      contract_start: formData.contract_start || null,
      contract_end: formData.contract_end || null,
    }
    if (formData.property_id) payload.property_id = parseInt(formData.property_id)

    const { error } = await supabase.from("tenants").insert([payload])
    if (error) {
      alert("❌ Error al guardar: " + error.message)
    } else {
      setOpen(false)
      setFormData({
        full_name: "", phone: "", email: "", property_id: "",
        contract_start: new Date().toISOString().split("T")[0],
        contract_end: "",
      })
      setDurationMonths("12")
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold shadow-sm w-full">
          <UserPlus className="w-4 h-4" /> Nuevo Inquilino
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Inquilino</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">

          {/* NOMBRE */}
          <div className="grid gap-2">
            <Label>Nombre completo *</Label>
            <Input
              placeholder="Nombre y apellidos"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          {/* TELÉFONO + EMAIL en la misma fila */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input
                type="tel"
                placeholder="6XX XXX XXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              {/* EMAIL */}
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          {/* INMUEBLE */}
          <div className="grid gap-2">
            <Label>Inmueble</Label>
            <Select value={formData.property_id} onValueChange={(val) => setFormData({ ...formData, property_id: val })}>
              <SelectTrigger><SelectValue placeholder="Selecciona un inmueble..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* FECHA INICIO */}
          <div className="grid gap-2">
            <Label>Inicio de contrato</Label>
            <Input
              type="date"
              value={formData.contract_start}
              onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
            />
          </div>

          {/* DURACIÓN DEL CONTRATO (desplegable) ← NUEVO */}
          <div className="grid gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <Label className="text-blue-800 font-bold">Duración del contrato</Label>
            <Select value={durationMonths} onValueChange={setDurationMonths}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona duración..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {CONTRACT_DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Si elige "Personalizado", muestra input de meses */}
            {durationMonths === "0" && (
              <div className="grid gap-1 mt-1">
                <Label className="text-xs text-blue-700">Número de meses</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ej: 18"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className="bg-white"
                />
              </div>
            )}
          </div>

          {/* FECHA FIN (calculada automáticamente, pero editable) */}
          <div className="grid gap-2">
            <Label>Fin de contrato <span className="text-slate-400 font-normal text-xs">(calculado automáticamente)</span></Label>
            <Input
              type="date"
              value={formData.contract_end}
              onChange={(e) => setFormData({ ...formData, contract_end: e.target.value })}
            />
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white mt-2 w-full">
            {loading ? "Guardando..." : "Registrar Inquilino"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
