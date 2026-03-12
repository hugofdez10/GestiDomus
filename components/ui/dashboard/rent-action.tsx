"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { HandCoins, CheckCircle2 } from "lucide-react"

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

export function RentAction({ onUpdate }: { onUpdate: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [propertiesList, setPropertiesList] = useState<any[]>([])

  const [formData, setFormData] = useState({
    property_id: "",
    month: new Date().getMonth().toString(),
    year: new Date().getFullYear().toString(),
    custom_amount: "" // NUEVO: Importe personalizable
  })

  useEffect(() => {
    if (open) {
      async function fetchProperties() {
        // Ordenamos los inmuebles alfabéticamente
        const { data } = await supabase.from('properties').select('id, name, price').order('name')
        if (data) setPropertiesList(data)
      }
      fetchProperties()
    }
  }, [open])

  // Cuando elegimos un piso, rellenamos automáticamente su precio por defecto, pero dejamos que el usuario lo edite
  const handlePropertyChange = (val: string) => {
    const selectedProp = propertiesList.find(p => p.id.toString() === val)
    setFormData({
      ...formData, 
      property_id: val,
      custom_amount: selectedProp ? selectedProp.price.toString() : ""
    })
  }

  async function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.property_id) {
      alert("Por favor, selecciona un inmueble.")
      return
    }

    setLoading(true)

    const finalAmount = parseFloat(formData.custom_amount) || 0

    const { error } = await supabase
      .from('rent_payments')
      .upsert({
        property_id: parseInt(formData.property_id),
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        amount: finalAmount, // Usamos el importe escrito a mano
        is_paid: true,
        paid_at: new Date().toISOString()
      }, { onConflict: 'property_id, month, year' })

    if (error) {
      alert("❌ Error al registrar el cobro: " + error.message)
    } else {
      setOpen(false)
      onUpdate() 
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-sm">
          <HandCoins className="w-4 h-4" /> Registrar Cobro
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Registrar Ingreso de Renta
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleRegisterPayment} className="grid gap-5 py-4">
          
          <div className="grid gap-2">
            <Label>Inmueble</Label>
            <Select value={formData.property_id} onValueChange={handlePropertyChange}>
              <SelectTrigger><SelectValue placeholder="Selecciona el piso..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {propertiesList.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Mes</Label>
              <Select value={formData.month} onValueChange={(val) => setFormData({...formData, month: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {MONTHS.map((m, i) => (<SelectItem key={i} value={i.toString()}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>Año</Label>
              <Select value={formData.year} onValueChange={(val) => setFormData({...formData, year: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
            <Label className="text-emerald-800 font-bold">Importe Cobrado (€)</Label>
            <Input 
              type="number" 
              step="0.01" 
              value={formData.custom_amount} 
              onChange={(e) => setFormData({...formData, custom_amount: e.target.value})} 
              className="font-black text-lg text-emerald-700 bg-white"
              required 
            />
            <p className="text-[10px] text-emerald-600">Puedes modificar la cantidad si el pago fue distinto este mes.</p>
          </div>

          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white mt-2 w-full">
            {loading ? "Registrando..." : "Confirmar Cobro"}
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  )
}