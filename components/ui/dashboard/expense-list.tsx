"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, CheckCircle2, AlertCircle, Trash2, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditExpenseForm } from "./edit-expense-form"

// Lista de meses para el filtro
const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" }
]

export function ExpenseList({ year }: { year: string }) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  
  // Estados para nuestros filtros
  const [propertyFilter, setPropertyFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState("all")

  async function fetchData() {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    // Pedimos a Supabase los gastos Y la lista de propiedades a la vez
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

  useEffect(() => {
    fetchData()
  }, [year])

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

  // LA MAGIA DE LOS FILTROS: Procesamos la lista antes de mostrarla
  const filteredExpenses = expenses.filter(exp => {
    // Comprobamos el inmueble
    const matchProp = 
      propertyFilter === "all" || 
      (exp.property_id && exp.property_id.toString() === propertyFilter) || 
      (propertyFilter === "general" && !exp.property_id)

    // Comprobamos el mes (sacamos el mes de la fecha "YYYY-MM-DD")
    const expenseMonth = exp.date.split('-')[1]
    const matchMonth = monthFilter === "all" || expenseMonth === monthFilter

    return matchProp && matchMonth
  })

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm w-full">
      
      {/* CABECERA CON LA BARRA DE FILTROS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500" />
          Historial de Gastos ({year})
        </h2>
        
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-lg border shadow-sm">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider hidden sm:inline-block">Filtrar:</span>
          
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[180px] bg-white h-8 text-xs font-medium border-slate-200">
              <SelectValue placeholder="Inmueble" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Todos los inmuebles</SelectItem>
              <SelectItem value="general">Gastos Generales (Sin piso)</SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[130px] bg-white h-8 text-xs font-medium border-slate-200">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Todos los meses</SelectItem>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* LA TABLA */}
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
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-8 h-8 text-slate-300" />
                    <p>No se han encontrado gastos con estos filtros.</p>
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