"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, UploadCloud, UserCircle, Home, ExternalLink } from "lucide-react"

export function EditExpenseForm({ expense, onUpdate }: { expense: any, onUpdate: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  const [propertiesList, setPropertiesList] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    category: expense.category || "",
    amount: expense.amount || "",
    date: expense.date || "",
    property_id: expense.property_id ? expense.property_id.toString() : "general",
    responsibility: expense.responsibility || "owner",
    is_tenant_paid: expense.is_tenant_paid === false ? "false" : "true"
  })

  useEffect(() => {
    if (open) {
      async function fetchProperties() {
        const { data } = await supabase.from('properties').select('id, name')
        if (data) setPropertiesList(data)
      }
      fetchProperties()
      
      // Reseteamos los datos al abrir por si han cambiado por fuera
      setFormData({
        category: expense.category || "",
        amount: expense.amount || "",
        date: expense.date || "",
        property_id: expense.property_id ? expense.property_id.toString() : "general",
        responsibility: expense.responsibility || "owner",
        is_tenant_paid: expense.is_tenant_paid === false ? "false" : "true"
      })
      setFile(null)
    }
  }, [open, expense])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    let finalReceiptUrl = expense.receipt_url

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

    const updatedExpense: any = {
      category: formData.category,
      amount: parseFloat(formData.amount.toString()),
      date: formData.date,
      receipt_url: finalReceiptUrl,
      responsibility: formData.responsibility,
      is_tenant_paid: formData.responsibility === 'owner' ? true : formData.is_tenant_paid === "true"
    }

    updatedExpense.property_id = formData.property_id !== "general" ? parseInt(formData.property_id) : null

    const { error } = await supabase.from('expenses').update(updatedExpense).eq('id', expense.id)

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
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-blue-600" title="Editar Gasto">
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Editar Gasto</DialogTitle>
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

          <div className="grid gap-2 p-3 bg-slate-50 border rounded-lg">
            <Label className="font-bold text-slate-700">Responsabilidad del Pago</Label>
            <Select value={formData.responsibility} onValueChange={(val) => setFormData({...formData, responsibility: val})}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="owner">
                  <div className="flex items-center gap-2"><Home className="w-4 h-4 text-blue-600"/> Gasto del Propietario (IBI, Seguro...)</div>
                </SelectItem>
                <SelectItem value="tenant">
                  <div className="flex items-center gap-2"><UserCircle className="w-4 h-4 text-orange-600"/> Gasto del Inquilino (Luz, Agua...)</div>
                </SelectItem>
              </SelectContent>
            </Select>

            {formData.responsibility === 'tenant' && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <Label className="text-orange-700">Estado de Cobro al Inquilino</Label>
                <Select value={formData.is_tenant_paid} onValueChange={(val) => setFormData({...formData, is_tenant_paid: val})}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="false">⚠️ PENDIENTE: Me lo debe</SelectItem>
                    <SelectItem value="true">✅ COBRADO: Ya me lo ha devuelto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Concepto</Label>
            <Input value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Importe (€)</Label>
              <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Fecha</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
            </div>
          </div>

          <div className="grid gap-2 pt-2 border-t mt-2">
            <Label className="flex items-center gap-2 text-blue-600 font-bold">
              <UploadCloud className="w-4 h-4" /> Modificar Factura
            </Label>
            {expense.receipt_url && !file && (
              <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 flex items-center gap-1 mb-2 hover:underline">
                <ExternalLink className="w-3 h-3" /> Ver factura actual
              </a>
            )}
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs cursor-pointer" />
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white mt-2 w-full">
            {loading ? "Guardando..." : "Actualizar Gasto"}
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  )
}