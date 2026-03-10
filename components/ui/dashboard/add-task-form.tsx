"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Hammer } from "lucide-react"

export function AddTaskForm() {
  const [properties, setProperties] = useState<any[]>([])
  const [propertyId, setPropertyId] = useState("")
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState("Media")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('properties').select('id, name')
      if (data) setProperties(data)
    }
    load()
  }, [])

  async function save() {
    if (!propertyId || !title || !dueDate) {
      alert("Rellena los campos obligatorios")
      return
    }
    const { error } = await supabase.from('maintenance_tasks').insert([{ 
      property_id: parseInt(propertyId), 
      title, 
      due_date: dueDate, 
      priority 
    }])
    
    if (!error) {
      setOpen(false)
      window.location.reload()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-amber-600 text-amber-600 hover:bg-amber-50 flex gap-2">
          <Hammer className="w-4 h-4" /> Nueva Tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white">
        <DialogHeader><DialogTitle>Programar Mantenimiento</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Título de la tarea</Label>
            <Input placeholder="Ej: Revisión Gas" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Inmueble</Label>
            <Select onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar piso..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {properties.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Fecha límite</Label>
            <Input type="date" onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Prioridad</Label>
            <Select onValueChange={setPriority} defaultValue="Media">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="Baja">Baja</SelectItem>
                <SelectItem value="Media">Media</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Crítica">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} className="bg-amber-600 text-white mt-2">Guardar Tarea</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}