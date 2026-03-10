"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PlusCircle, Euro, Building2 } from "lucide-react"

export function AddPropertyForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    price: "", // Renta mensual
    purchase_price: "", // Inversión total
    construction_value: "" // Para amortización
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('properties').insert([{
      name: formData.name,
      address: formData.address,
      price: parseFloat(formData.price),
      purchase_price: parseFloat(formData.purchase_price),
      construction_value: parseFloat(formData.construction_value),
      status: 'Alquilado'
    }])

    if (!error) {
      setOpen(false)
      window.location.reload()
    } else {
      alert("Error al guardar: " + error.message)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2">
          <PlusCircle className="w-4 h-4" /> Nuevo Inmueble
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Activo al Portafolio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre del Inmueble</Label>
            <Input id="name" placeholder="Ej: Piso Calle Mayor" required
              onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price">Renta Mensual (€)</Label>
              <Input id="price" type="number" placeholder="850" required
                onChange={(e) => setFormData({...formData, price: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purchase_price">Precio Compra (€)</Label>
              <Input id="purchase_price" type="number" placeholder="150000" required
                onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="construction_value" className="flex items-center gap-2">
              Valor Construcción (€) <span className="text-[10px] text-slate-400">(Suele ser el 70% del total)</span>
            </Label>
            <Input id="construction_value" type="number" placeholder="105000" required
              onChange={(e) => setFormData({...formData, construction_value: e.target.value})} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Dirección Completa</Label>
            <Input id="address" placeholder="Calle Falsa 123, 2ºB" 
              onChange={(e) => setFormData({...formData, address: e.target.value})} />
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 text-white mt-4">
            {loading ? "Guardando..." : "Registrar Inmueble"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}