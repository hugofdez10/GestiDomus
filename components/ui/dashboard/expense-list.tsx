"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, CheckCircle2, AlertCircle, Filter, ExternalLink, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EditExpenseForm } from "./edit-expense-form"
import { exportTablePdf, formatDateEs, formatEuro } from "@/lib/pdf-export"
import { getStorageDisplayUrl } from "@/lib/storage"

const CONCEPTOS = [
  "Seguro", "Limpieza", "Comunidad", "Electricidad", "Gas", 
  "Agua", "IBI", "Internet", "Hipoteca", "Derrama", "Basura", "Otro"
]

type ExpenseRow = {
  id: number
  category: string
  amount: number
  date: string
  property_id: number | null
  responsibility: string | null
  is_tenant_paid: boolean | null
  receipt_url: string | null
  properties?: { name?: string | null } | null
}

type PropertyOption = {
  id: number
  name: string
}

export function ExpenseList({ year: globalYear }: { year: string }) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  
  const [localYear, setLocalYear] = useState(globalYear || new Date().getFullYear().toString())
  const [propertyFilter, setPropertyFilter] = useState("all")
  const [conceptFilter, setConceptFilter] = useState("all")
  const [respFilter, setRespFilter] = useState("all")

  // ─── NUEVO: visor de factura inline ─────────────────────────────────────────
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null)

  useEffect(() => { setLocalYear(globalYear) }, [globalYear])

  async function fetchData() {
    const startDate = `${localYear}-01-01`
    const endDate = `${localYear}-12-31`
    const [expRes, propRes] = await Promise.all([
      supabase.from('expenses').select('*, properties(name)').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
      supabase.from('properties').select('id, name').order('name')
    ])
    if (expRes.data) setExpenses(expRes.data as ExpenseRow[])
    if (propRes.data) setProperties(propRes.data as PropertyOption[])
  }

  useEffect(() => { fetchData() }, [localYear])

  async function markAsPaidByTenant(id: number) {
    const { error } = await supabase.from('expenses').update({ is_tenant_paid: true }).eq('id', id)
    if (error) alert("Error al actualizar: " + error.message)
    else fetchData()
  }

  async function handleDelete(id: number) {
    if (window.confirm("¿Seguro que quieres eliminar este gasto?")) {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) alert("Error al borrar: " + error.message)
      else fetchData()
    }
  }

  const filteredExpenses = expenses.filter(exp => {
    const matchProp = propertyFilter === "all" || (exp.property_id && exp.property_id.toString() === propertyFilter) || (propertyFilter === "general" && !exp.property_id)
    const matchConcept = conceptFilter === "all" || exp.category === conceptFilter
    const matchResp = respFilter === "all" || exp.responsibility === respFilter
    return matchProp && matchConcept && matchResp
  })

  const isPdf = (url: string) => url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf')
  const isImage = (url: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)

  async function openReceipt(storedUrl: string) {
    try {
      setViewReceiptUrl(await getStorageDisplayUrl(supabase, "vault", storedUrl))
    } catch {
      alert("No se pudo abrir la factura temporalmente.")
    }
  }

  function exportFilteredPdf() {
    const total = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)

    exportTablePdf({
      title: `Historial de gastos ${localYear}`,
      subtitle: `Filtros: inmueble ${propertyFilter}, concepto ${conceptFilter}, responsabilidad ${respFilter}`,
      fileName: `Gastos_${localYear}_${propertyFilter}_${conceptFilter}.pdf`,
      rows: filteredExpenses,
      summary: [
        `Registros: ${filteredExpenses.length}`,
        `Total gastos: ${formatEuro(total)}`,
      ],
      columns: [
        { header: "Fecha", value: (exp) => formatDateEs(exp.date) },
        { header: "Concepto", value: "category" },
        { header: "Inmueble", value: (exp) => exp.properties?.name || "General" },
        { header: "Importe", value: (exp) => formatEuro(exp.amount) },
        { header: "Responsabilidad", value: (exp) => exp.responsibility === "tenant" ? "Inquilino" : "Propietario" },
        { header: "Factura", value: (exp) => exp.receipt_url ? "Adjunta" : "Sin adjunto" },
      ],
    })
  }

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm w-full">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 pb-4 border-b">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight uppercase">
            <span className="text-2xl">💸</span>
            Historial de Gastos
          </h2>
          <p className="text-sm text-slate-500 font-medium">Consulta y gestiona todos los gastos registrados en el sistema.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 mr-4 border-r pr-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Año</span>
            <Select value={localYear} onValueChange={setLocalYear}>
              <SelectTrigger className="w-[90px] h-8 font-black text-red-700 bg-red-50 border-red-200"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <button
            type="button"
            onClick={exportFilteredPdf}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
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
                  <TableCell className="font-medium text-slate-600">{new Date(exp.date).toLocaleDateString('es-ES')}</TableCell>
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
                        // ─── CAMBIADO: visor interno en lugar de nueva pestaña ───
                        <button
                          onClick={() => exp.receipt_url && openReceipt(exp.receipt_url)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          title="Ver Factura"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      <EditExpenseForm expense={exp} onUpdate={fetchData} />
                      <button onClick={() => handleDelete(exp.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Borrar Gasto">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── NUEVO: Visor de factura inline ─────────────────────────────────── */}
      <Dialog open={!!viewReceiptUrl} onOpenChange={(o) => { if (!o) setViewReceiptUrl(null) }}>
        <DialogContent className="w-[95vw] max-w-3xl bg-white p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <FileText className="w-5 h-5 text-blue-600" />
              Factura / Documento adjunto
            </DialogTitle>
          </DialogHeader>
          {viewReceiptUrl && (
            <div className="flex flex-col">
              <div className="bg-slate-100 flex items-center justify-center" style={{ minHeight: '65vh' }}>
                {isPdf(viewReceiptUrl) ? (
                  <iframe
                    src={viewReceiptUrl}
                    className="w-full"
                    style={{ height: '65vh', border: 'none' }}
                    title="Factura PDF"
                  />
                ) : isImage(viewReceiptUrl) ? (
                  <img
                    src={viewReceiptUrl}
                    alt="Factura"
                    className="max-w-full max-h-[65vh] object-contain p-2"
                  />
                ) : (
                  <div className="text-center text-slate-500 px-6">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold text-slate-700">Este documento no tiene vista previa en el navegador.</p>
                    <p className="text-sm mt-1">Puedes abrirlo o descargarlo desde los botones inferiores.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white">
                <span className="text-xs text-slate-400">
                  {isPdf(viewReceiptUrl) ? "📄 Documento PDF" : "🖼️ Imagen"}
                </span>
                <div className="flex gap-2">
                  <a
                    href={viewReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir en nueva pestaña
                  </a>
                  <a
                    href={viewReceiptUrl}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar
                  </a>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
