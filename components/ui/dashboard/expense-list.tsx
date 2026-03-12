"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, CheckCircle2, AlertCircle, Trash2, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditExpenseForm } from "./edit-expense-form"

const CONCEPTOS = [
  "Seguro", "Limpieza", "Comunidad", "Electricidad", "Gas", 
  "Agua", "IBI", "Internet", "Hipoteca", "Derrama", "Basura", "Otro"
]

export function ExpenseList({ year: globalYear }: { year: string }) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  
  // Filtros Locales (independientes del dashboard global)
  const [localYear, setLocalYear] = useState(globalYear || new Date().getFullYear().toString())
  const [propertyFilter, setPropertyFilter] = useState("all")
  const [conceptFilter, setConceptFilter] = useState("all")
  const [respFilter, setRespFilter] = useState("all")

  // Si cambia el año global, actualizamos el local por comodidad
  useEffect(() => {
    setLocalYear(globalYear)
  }, [globalYear])

  async function fetchData() {
    const startDate = `${localYear}-01-01`
    const endDate = `${localYear}-12-31`

    const [expRes, propRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, properties(name)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase.from('properties').select('id, name').order('name')
    ])
    
    if (expRes.data) setExpenses(expRes.data)
    if (propRes.data) setProperties(propRes.data)
  }

  // Recargar datos cada vez que cambiemos EL AÑO LOCAL
  useEffect(() => {
    fetchData()
  }, [localYear])

  async function markAsPaidByTenant(id: number) {
    const { error } = await supabase.from('expenses').update({ is_tenant_paid: true }).eq('id', id)
    if (error) alert("Error al actualizar: " + error.message)
    else fetchData()
  }

  async function handleDelete(id: number) {
    if (window.confirm("🚨 ¿Seguro que quieres eliminar este gasto por completo?")) {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) alert("Error al borrar: " + error.message)
      else fetchData()
    }
  }

  // Filtramos la información descargada en vivo
  const filteredExpenses = expenses.filter(exp => {
    const matchProp = propertyFilter === "all" || (exp.property_id && exp.property_id.toString() === propertyFilter) || (propertyFilter === "general" && !exp.property_id)
    const matchConcept = conceptFilter === "all" || exp.category === conceptFilter
    const matchResp = respFilter === "all" || exp.responsibility === respFilter
    
    return matchProp && matchConcept && matchResp
  })

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm w-full">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-red-500" />
          <h2 className="text-lg font-bold text-slate-800">Historial de Gastos</h2>
          {/* AÑO INDEPENDIENTE */}
          <Select value={localYear} onValueChange={setLocalYear}>
            <SelectTrigger className="w-[90px] h-8 font-black text-red-700 bg-red-50 border-red-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-lg border shadow-sm">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[140px] bg-white h-8 text-xs font-medium border-slate-200"><SelectValue placeholder="Inmueble" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Todos los Inmuebles</SelectItem>
              <SelectItem value="general">Gastos Generales</SelectItem>
              {properties.map(p => (<SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={conceptFilter} onValueChange={setConceptFilter}>
            <SelectTrigger className="w-[120px] bg-white h-8 text-xs font-medium border-slate-200"><SelectValue placeholder="Concepto" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Todo el año</SelectItem>
              {CONCEPTOS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={respFilter} onValueChange={setRespFilter}>
            <SelectTrigger className="w-[150px] bg-white h-8 text-xs font-medium border-slate-200"><SelectValue placeholder="Responsabilidad" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Ambas partes</SelectItem>
              <SelectItem value="owner">Gasto Propietario</SelectItem>
              <SelectItem value="tenant">Gasto Inquilino</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Inmueble</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="text-center">Responsabilidad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* ... Aquí dentro va el mismo código de renderizado de la tabla de antes (filteredExpenses.map...) ... */}
             {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-8 h-8 text-slate-300" />
                    <p>No se han encontrado gastos con estos filtros en {localYear}.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium text-slate-600">
                    {new Date(exp.date).toLocaleDateString('es-ES')}
                  </TableCell>
                  <TableCell className="font-bold text-slate-800">{exp.category}</TableCell>
                  <TableCell className="text-slate-500">{exp.properties?.name || "General"}</TableCell>
                  <TableCell className="text-right font-black text-red-600">-{exp.amount} €</TableCell>
                  
                  <TableCell className="text-center">
                    {exp.responsibility === 'tenant' ? (
                      exp.is_tenant_paid ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Cobrado al inquilino
                        </Badge>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 gap-1 text-[10px] animate-pulse">
                            <AlertCircle className="w-3 h-3" /> Pendiente de cobro
                          </Badge>
                          <button onClick={() => markAsPaidByTenant(exp.id)} className="text-[10px] font-bold text-orange-600 hover:text-orange-800 underline">
                            Marcar como devuelto
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">Gasto Propietario</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-1">
                      {exp.receipt_url && (
                        <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Ver Factura">
                          <FileText className="w-4 h-4" />
                        </a>
                      )}
                      <EditExpenseForm expense={exp} onUpdate={fetchData} />
                      <button onClick={() => handleDelete(exp.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Borrar Gasto">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}