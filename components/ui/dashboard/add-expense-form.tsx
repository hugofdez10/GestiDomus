"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, UploadCloud, UserCircle, Home } from "lucide-react"

// Lista de conceptos basada en tu documento Word
const CONCEPTOS = [
  "Seguro", "Limpieza", "Comunidad", "Electricidad", "Gas", 
  "Agua", "IBI", "Internet", "Hipoteca", "Derrama", "Basura", "Otro"
]

export function AddExpenseForm({ properties }: { properties?: any[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  const [propertiesList, setPropertiesList] = useState<any[]>(properties || [])
  
  const [formData, setFormData] = useState({
    category: "", // Ahora esto será el desplegable
    amount: "",
    date: new Date().toISOString().split('T')[0],
    property_id: "general",
    responsibility: "owner",
    is_tenant_paid: "true" 
  })

  useEffect(() => {
    if (open) {
      async function fetchProperties() {
        // Añadido: .order('name') para que salgan siempre ordenados
        const { data } = await supabase.from('properties').select('id, name').order('name')
        if (data) setPropertiesList(data)
      }
      fetchProperties()
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.category) {
      alert("Debes seleccionar un concepto.")
      return
    }

    setLoading(true)
    let finalReceiptUrl = null

    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `gasto-${Date.now()}.${fileExt}`
      const filePath = `gastos/${fileName}`
      const { error: uploadError } = await supabase.storage.from('vault').upload(filePath, file)
      if (!uploadError) {
        const { data } = supabase.storage.from('vault').getPublicUrl(filePath)
        finalReceiptUrl = data.publicUrl
      }
    }

    const newExpense: any = {
      category: formData.category,
      amount: parseFloat(formData.amount.toString()),
      date: formData.date,
      receipt_url: finalReceiptUrl,
      responsibility: formData.responsibility,
      is_tenant_paid: formData.responsibility === 'owner' ? true : formData.is_tenant_paid === "true"
    }

    if (formData.property_id !== "general") {
      newExpense.property_id = parseInt(formData.property_id)
    }

    const { error } = await supabase.from('expenses').insert([newExpense])

    if (error) {
      alert("❌ Error al guardar: " + error.message)
    } else {
      setOpen(false)
      setFile(null)
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-sm font-bold">
          <Plus className="w-4 h-4" /> Registrar Gasto
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Gasto / Factura</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          <div className="grid gap-2">
            <Label>Inmueble</Label>
            <Select value={formData.property_id} onValueChange={(val) => setFormData({...formData, property_id: val})}>
              <SelectTrigger><SelectValue placeholder="Selecciona un inmueble..." /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="general">Gasto General (No vinculado)</SelectItem>
                {propertiesList.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Concepto</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
              <SelectTrigger><SelectValue placeholder="Selecciona el tipo de suministro/gasto..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {CONCEPTOS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 p-3 bg-slate-50 border rounded-lg">
            <Label className="font-bold text-slate-700">Responsabilidad del Pago</Label>
            <Select value={formData.responsibility} onValueChange={(val) => setFormData({...formData, responsibility: val})}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="owner">
                  <div className="flex items-center gap-2"><Home className="w-4 h-4 text-blue-600"/> Gasto del Propietario</div>
                </SelectItem>
                <SelectItem value="tenant">
                  <div className="flex items-center gap-2"><UserCircle className="w-4 h-4 text-orange-600"/> Gasto del Inquilino</div>
                </SelectItem>
              </SelectContent>
            </Select>

            {formData.responsibility === 'tenant' && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <Label className="text-orange-700">Estado de Cobro al Inquilino</Label>
                <Select value={formData.is_tenant_paid} onValueChange={(val) => setFormData({...formData, is_tenant_paid: val})}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="false">⚠️ PENDIENTE: Lo he pagado yo y me lo debe</SelectItem>
                    <SelectItem value="true">✅ COBRADO: Ya está devuelto o domiciliado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Importe (€)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Fecha</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
            </div>
          </div>

          <div className="grid gap-2 pt-2 border-t mt-2">
            <Label className="flex items-center gap-2 text-blue-600 font-bold">
              <UploadCloud className="w-4 h-4" /> Adjuntar Factura / Ticket
            </Label>
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs cursor-pointer" />
          </div>

          <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white mt-2 w-full">
            {loading ? "Guardando..." : "Registrar Gasto"}
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  )
}