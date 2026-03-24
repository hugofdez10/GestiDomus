"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Pencil } from "lucide-react"

export function EditPropertyForm({ property, onUpdate }: { property: any, onUpdate: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: property.name || "",
    address: property.address || "",
    price: property.price || 0,
    purchase_price: property.purchase_price || 0,
    construction_value: property.construction_value || 0,
    payment_account_holder: property.payment_account_holder || "",
    payment_account_iban: property.payment_account_iban || "",
    sender_email: property.sender_email || "",
  })

  useEffect(() => {
    if (open) {
      setFormData({
        name: property.name || "",
        address: property.address || "",
        price: property.price || 0,
        purchase_price: property.purchase_price || 0,
        construction_value: property.construction_value || 0,
        payment_account_holder: property.payment_account_holder || "",
        payment_account_iban: property.payment_account_iban || "",
        sender_email: property.sender_email || "",
      })
    }
  }, [open, property])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase
      .from("properties")
      .update({
        name: formData.name,
        address: formData.address,
        price: parseFloat(formData.price.toString()),
        purchase_price: parseFloat(formData.purchase_price.toString()),
        construction_value: parseFloat(formData.construction_value.toString()),
        payment_account_holder: formData.payment_account_holder || null,
        payment_account_iban: formData.payment_account_iban || null,
        sender_email: formData.sender_email || null,
      })
      .eq("id", property.id)
      .select()

    if (error) {
      alert("❌ Error de servidor: " + error.message)
    } else if (!data || data.length === 0) {
      alert("⚠️ El sistema no pudo actualizar el piso. Verifica que no haya bloqueos de seguridad.")
    } else {
      setOpen(false)
      onUpdate()
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500" title="Editar Activo">
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Editar {property.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nombre del Inmueble</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label>Dirección / calle</Label>
            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Renta Mensual (€)</Label>
              <Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Precio Compra (€)</Label>
              <Input type="number" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Valor Construcción (€)</Label>
            <Input type="number" value={formData.construction_value} onChange={(e) => setFormData({ ...formData, construction_value: e.target.value })} />
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 grid gap-3">
            <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">Datos por defecto para recibos</p>
            <div className="grid gap-2">
              <Label>Titular cuenta cobro</Label>
              <Input value={formData.payment_account_holder} onChange={(e) => setFormData({ ...formData, payment_account_holder: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>IBAN cobro</Label>
              <Input value={formData.payment_account_iban} onChange={(e) => setFormData({ ...formData, payment_account_iban: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email remitente por defecto</Label>
              <Input value={formData.sender_email} onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })} />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 text-white mt-2">
            {loading ? "Guardando cambios..." : "Actualizar Inmueble"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
