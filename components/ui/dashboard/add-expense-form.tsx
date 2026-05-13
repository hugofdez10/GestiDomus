"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, FileText, Home, Loader2, Plus, Sparkles, UploadCloud, UserCircle, X } from "lucide-react"

const CONCEPTOS = [
  "Seguro",
  "Limpieza",
  "Comunidad",
  "Electricidad",
  "Gas",
  "Agua",
  "IBI",
  "Internet",
  "Hipoteca",
  "Derrama",
  "Basura",
  "Otro",
]

type PropertyOption = {
  id: number
  name: string
  address?: string | null
  supplies?: Record<string, { company?: string; contract?: string } | undefined> | null
}

type ExpenseAnalysis = {
  category: string | null
  amount: number | null
  date: string | null
  property_id: number | null
  property_name: string | null
  responsibility: "owner" | "tenant" | null
  confidence: number
  notes: string
  source: "ai" | "heuristic"
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      resolve(result.includes(",") ? result.split(",")[1] : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

export function AddExpenseForm({ properties }: { properties?: PropertyOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ExpenseAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [propertiesList, setPropertiesList] = useState<PropertyOption[]>(properties || [])

  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    property_id: "general",
    responsibility: "owner",
    is_tenant_paid: "true",
  })

  const loadProperties = useCallback(async () => {
    const { data } = await supabase.from("properties").select("id, name, address, supplies").order("name")
    if (data) {
      const nextProperties = data as PropertyOption[]
      setPropertiesList(nextProperties)
      return nextProperties
    }

    return [] as PropertyOption[]
  }, [])

  useEffect(() => {
    if (open) void loadProperties()
  }, [open, loadProperties])

  function applyAnalysis(result: ExpenseAnalysis) {
    setFormData((prev) => {
      const nextResponsibility = result.responsibility || prev.responsibility

      return {
        ...prev,
        category: result.category || prev.category,
        amount: result.amount != null ? String(result.amount) : prev.amount,
        date: result.date || prev.date,
        property_id: result.property_id ? String(result.property_id) : prev.property_id,
        responsibility: nextResponsibility,
        is_tenant_paid: nextResponsibility === "tenant" ? "false" : prev.is_tenant_paid,
      }
    })
  }

  async function analyzeInvoiceFile(selectedFile: File, knownProperties = propertiesList) {
    setAnalyzing(true)
    setAnalysis(null)
    setAnalysisError(null)

    try {
      if (selectedFile.size > 15 * 1024 * 1024) {
        throw new Error("La factura supera 15 MB. Sube un PDF o imagen mas ligero.")
      }

      const base64 = await fileToBase64(selectedFile)
      const res = await fetch("/api/analyze-expense-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          base64,
          properties: knownProperties,
          categories: CONCEPTOS,
        }),
      })

      const result = (await res.json()) as ExpenseAnalysis
      if (!res.ok) throw new Error(result?.notes || "No se pudo analizar la factura.")

      setAnalysis(result)
      applyAnalysis(result)
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "No se pudo analizar la factura.")
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.category) {
      alert("Debes seleccionar un concepto.")
      return
    }

    setLoading(true)
    let finalReceiptUrl: string | null = null

    if (file) {
      const fileExt = file.name.split(".").pop() || "pdf"
      const baseName = safeFileName(file.name.replace(/\.[^.]+$/, "")) || "factura"
      const filePath = `gastos/gasto-${Date.now()}-${baseName}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from("vault").upload(filePath, file, {
        upsert: true,
        contentType: file.type || undefined,
      })

      if (uploadError) {
        setLoading(false)
        alert("Error al subir la factura: " + uploadError.message)
        return
      }

      const { data } = supabase.storage.from("vault").getPublicUrl(filePath)
      finalReceiptUrl = data.publicUrl
    }

    const newExpense: Record<string, string | number | boolean | null> = {
      category: formData.category,
      amount: parseFloat(formData.amount.toString()),
      date: formData.date,
      receipt_url: finalReceiptUrl,
      responsibility: formData.responsibility,
      is_tenant_paid: formData.responsibility === "owner" ? true : formData.is_tenant_paid === "true",
    }

    if (formData.property_id !== "general") {
      newExpense.property_id = parseInt(formData.property_id)
    }

    const { error } = await supabase.from("expenses").insert([newExpense])

    if (error) {
      alert("Error al guardar: " + error.message)
    } else {
      setOpen(false)
      setFile(null)
      setAnalysis(null)
      window.location.reload()
    }
    setLoading(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
    setAnalysis(null)
    setAnalysisError(null)

    if (selectedFile) {
      const knownProperties = propertiesList.length ? propertiesList : await loadProperties()
      await analyzeInvoiceFile(selectedFile, knownProperties)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-sm font-bold">
          <Plus className="w-4 h-4" /> Registrar Gasto
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-white sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Gasto / Factura</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className={`grid gap-2 p-3 rounded-lg border-2 transition-colors ${file ? "border-green-400 bg-green-50" : "border-dashed border-blue-300 bg-blue-50"}`}>
            <Label className="flex items-center gap-2 text-blue-700 font-bold">
              <UploadCloud className="w-4 h-4" />
              Adjuntar y leer factura
              <span className="text-xs font-normal text-blue-500">(opcional)</span>
            </Label>

            {file ? (
              <div className="flex items-center gap-2 bg-white border border-green-300 rounded-md px-3 py-2">
                <FileText className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-800 truncate">{file.name}</p>
                  <p className="text-xs text-green-600">{(file.size / 1024).toFixed(0)} KB - listo para subir</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setAnalysis(null)
                    setAnalysisError(null)
                  }}
                  className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition-colors"
                  title="Quitar archivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 py-4 border border-dashed border-blue-300 rounded-md cursor-pointer hover:bg-blue-100 transition-colors">
                <UploadCloud className="w-7 h-7 text-blue-400" />
                <span className="text-xs text-blue-600 font-medium">Pulsa aquí para adjuntar la factura</span>
                <span className="text-[10px] text-blue-400">PDF, JPG, PNG o DOCX</span>
                <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
              </label>
            )}

            {file && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => analyzeInvoiceFile(file)}
                disabled={analyzing}
                className="justify-center bg-white"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-blue-600" />}
                {analyzing ? "Analizando factura..." : "Volver a analizar con IA"}
              </Button>
            )}

            {analysis && (
              <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-bold text-blue-700 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {analysis.source === "ai" ? "Factura leída con IA" : "Factura estimada por coincidencias"}
                  <span className="font-normal text-blue-500">({Math.round((analysis.confidence || 0) * 100)}%)</span>
                </div>
                <p>
                  He rellenado lo detectado: {analysis.property_name || "inmueble pendiente"}, {analysis.category || "concepto pendiente"}
                  {analysis.amount != null ? `, ${analysis.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : ""}.
                </p>
                {analysis.notes && <p className="mt-1 text-slate-400">{analysis.notes}</p>}
              </div>
            )}

            {analysisError && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {analysisError}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Inmueble</Label>
            <Select value={formData.property_id} onValueChange={(val) => setFormData({ ...formData, property_id: val })}>
              <SelectTrigger><SelectValue placeholder="Selecciona un inmueble..." /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="general">Gasto General (No vinculado)</SelectItem>
                {propertiesList.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Concepto</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
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
            <Select value={formData.responsibility} onValueChange={(val) => setFormData({ ...formData, responsibility: val })}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="owner">
                  <div className="flex items-center gap-2"><Home className="w-4 h-4 text-blue-600" /> Gasto del Propietario</div>
                </SelectItem>
                <SelectItem value="tenant">
                  <div className="flex items-center gap-2"><UserCircle className="w-4 h-4 text-orange-600" /> Gasto del Inquilino</div>
                </SelectItem>
              </SelectContent>
            </Select>

            {formData.responsibility === "tenant" && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <Label className="text-orange-700">Estado de Cobro al Inquilino</Label>
                <Select value={formData.is_tenant_paid} onValueChange={(val) => setFormData({ ...formData, is_tenant_paid: val })}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="false">Pendiente: lo he pagado yo y me lo debe</SelectItem>
                    <SelectItem value="true">Cobrado: ya está devuelto o domiciliado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Importe (€)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>Fecha</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
            </div>
          </div>

          <Button type="submit" disabled={loading || analyzing} className="bg-red-600 hover:bg-red-700 text-white mt-2 w-full">
            {loading ? (file ? "Subiendo factura y guardando..." : "Guardando...") : (
              <span className="flex items-center gap-2 justify-center">
                <Plus className="w-4 h-4" />
                Registrar Gasto{file ? " + Factura" : ""}
              </span>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
