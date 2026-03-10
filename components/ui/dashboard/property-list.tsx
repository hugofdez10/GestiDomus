"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PropertyDocs } from "./property-docs"
import { EditPropertyForm } from "./edit-property-form"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { FileText, TrendingUp, Trash2 } from "lucide-react"

export function PropertyList() {
  const [properties, setProperties] = useState<any[]>([])

  async function fetchProperties() {
    const { data, error } = await supabase
      .from('properties')
      .select('*, tenants(full_name), expenses(amount)')
    
    if (!error && data) {
      const formatted = data.map(p => {
        const annualRevenue = (p.price || 0) * 12
        const totalExp = p.expenses?.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0) || 0
        const amortization = (p.construction_value || 0) * 0.03
        const netProfit = annualRevenue - totalExp - amortization
        const roi = p.purchase_price && p.purchase_price > 0 ? (netProfit / p.purchase_price) * 100 : 0
        
        let healthColor = "bg-emerald-500"
        if (totalExp > (p.price * 0.5)) healthColor = "bg-red-500"
        else if (totalExp > (p.price * 0.2)) healthColor = "bg-amber-500"

        return { ...p, healthColor, roi }
      })
      setProperties(formatted)
    }
  }

  useEffect(() => { fetchProperties() }, [])

  // NUEVA FUNCIÓN: Borrar Inmueble con confirmación de seguridad
  async function handleDelete(id: number, name: string) {
    if (window.confirm(`🚨 ¿ESTÁS SEGURO?\n\nVas a eliminar el inmueble "${name}" de tu cartera. Esta acción no se puede deshacer y borrará los datos vinculados.`)) {
      const { error } = await supabase.from('properties').delete().eq('id', id)
      
      if (!error) {
        window.location.reload() // Recargamos para actualizar los KPIs de dinero arriba
      } else {
        alert("Error al eliminar: " + error.message)
      }
    }
  }

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-[50px]">Salud</TableHead>
            <TableHead>Inmueble</TableHead>
            <TableHead>ROI Neto</TableHead>
            <TableHead>Inquilino</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((p) => (
            <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
              <TableCell><div className={`w-3 h-3 rounded-full ${p.healthColor} shadow-sm`} /></TableCell>
              <TableCell>
                <p className="font-bold text-slate-700">{p.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{p.status}</p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className={`w-3.5 h-3.5 ${(p.roi || 0) > 5 ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <span className={`font-black ${(p.roi || 0) > 5 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {(p.roi || 0).toFixed(2)}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-slate-600 text-sm">{p.tenants?.[0]?.full_name || "Vacante"}</TableCell>
              <TableCell className="text-right flex justify-end items-center gap-1">
                
                {/* BOTÓN EDITAR */}
                <EditPropertyForm property={p} onUpdate={fetchProperties} />
                
                {/* BOTÓN DOCUMENTOS */}
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="p-2 hover:bg-blue-50 rounded-full transition-colors text-blue-600" title="Expediente">
                      <FileText className="w-4 h-4" />
                    </button>
                  </SheetTrigger>
                  <SheetContent className="bg-white w-[400px]">
                    <SheetHeader><SheetTitle>Expediente: {p.name}</SheetTitle></SheetHeader>
                    <div className="mt-6"><PropertyDocs propertyId={p.id} /></div>
                  </SheetContent>
                </Sheet>

                {/* BOTÓN BORRAR */}
                <button 
                  onClick={() => handleDelete(p.id, p.name)}
                  className="p-2 hover:bg-red-50 rounded-full transition-colors text-slate-400 hover:text-red-600" 
                  title="Eliminar Piso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}