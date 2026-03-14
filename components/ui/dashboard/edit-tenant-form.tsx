"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil } from "lucide-react"

const CONTRACT_DURATIONS = [
  { label: "6 meses",              value: 6 },
  { label: "11 meses",             value: 11 },
  { label: "12 meses (1 año)",     value: 12 },
  { label: "24 meses (2 años)",    value: 24 },
  { label: "36 meses (3 años)",    value: 36 },
  { label: "60 meses (5 años)",    value: 60 },
  { label: "Personalizado",        value: 0 },
]

export function EditTenantForm({ tenant, onUpdate }: { tenant: any; onUpdate: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [durationMonths, setDurationMonths] = useState<string>("0")
  const [customDuration, setCustomDuration] = useState<string>("")

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    property_id: "",
    contract_start: "",
    contract_end: "",
    is_extended: false,   // ← campo Prorrogado
  })

  useEffect(() => {
    if (open) {
      setFormData({
        full_name: tenant.full_name || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
        property_id: tenant.property_id?.toString() || "",
        contract_start: tenant.contract_start || "",
        contract_end: tenant.contract_end || "",
        is_extended: tenant.is_extended || false,
      })
      // Dejar duración en "Personalizado" al abrir edición
      setDurationMonths("0")
      setCustomDuration("")

      supabase.from("properties").select("id, name").order("name").then(({ data }) => {
        if (data) setProperties(data)
      })
    }
  }, [open, tenant])

  // Recalcula fecha fin al cambiar duración
  function applyDuration(months: number) {
    if (!formData.contract_start || !months) return
    const start = new Date(formData.contract_start)
    start.setMonth(start.getMonth() + months)
    setFormData(prev => ({
      ...prev,
      contract_end: start.toISOString().split("T")[0]
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const payload: any = {
      full_name: formData.full_name,
      phone: formData.phone || null,
      email: formData.email || null,
      contract_start: formData.contract_start || null,
      contract_end: formData.contract_end || null,
      is_extended: formData.is_extended,
    }
    if (formData.property_id) payload.property_id = parseInt(formData.property_id)

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
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Inquilino</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">

          <div className="grid gap-2">
            <Label>Nombre completo</Label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          {/* TELÉFONO + EMAIL */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

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

          {/* INICIO */}
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
            <Label className="text-blue-800 font-bold">Recalcular duración</Label>
            <Select value={durationMonths} onValueChange={(val) => {
              setDurationMonths(val)
              if (val !== "0") applyDuration(parseInt(val))
            }}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona duración..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {CONTRACT_DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {durationMonths === "0" && (
              <div className="grid gap-1 mt-1">
                <Label className="text-xs text-blue-700">Número de meses</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ej: 18"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    className="bg-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => applyDuration(parseInt(customDuration))}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* FIN */}
          <div className="grid gap-2">
            <Label>Fin de contrato</Label>
            <Input
              type="date"
              value={formData.contract_end}
              onChange={(e) => setFormData({ ...formData, contract_end: e.target.value })}
            />
          </div>

          {/* PRORROGADO ← NUEVO */}
          <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
            <input
              type="checkbox"
              id="is_extended"
              checked={formData.is_extended}
              onChange={(e) => setFormData({ ...formData, is_extended: e.target.checked })}
              className="w-4 h-4 accent-purple-600"
            />
            <Label htmlFor="is_extended" className="text-purple-800 font-bold cursor-pointer">
              Contrato Prorrogado
            </Label>
            <span className="text-xs text-purple-500">(aparecerá como "Prorrogado" aunque tenga fecha pasada)</span>
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white mt-2 w-full">
            {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
