"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, FileDown, Save } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

type InvoiceTemplateData = {
  invoiceNumber: string
  date: string
  landlordName: string
  landlordTaxId: string
  landlordAddress: string
  landlordEmail: string
  tenantName: string
  tenantTaxId: string
  tenantAddress: string
  tenantEmail: string
  concept: string
  netAmount: string
  vatAmount: string
  irpfAmount: string
  iban: string
  paymentMethod: string
  note: string
}

const LEGACY_STORAGE_KEY = "gestidomus_invoice_template_alquiler_abril"
const STORAGE_KEY = "gestidomus_invoice_template_generic_v2"
const DOCX_URL = "/templates/factura-alquiler-abril.docx"

const DEFAULT_TEMPLATE: InvoiceTemplateData = {
  invoiceNumber: "2026/001",
  date: "2026-01-01",
  landlordName: "Nombre del arrendador",
  landlordTaxId: "00000000X",
  landlordAddress: "Direccion del arrendador",
  landlordEmail: "arrendador@example.com",
  tenantName: "Nombre del arrendatario",
  tenantTaxId: "B00000000",
  tenantAddress: "Direccion del arrendatario",
  tenantEmail: "arrendatario@example.com",
  concept:
    "Arrendamiento de vivienda situada en direccion del inmueble, correspondiente al periodo indicado, con arreglo a lo estipulado en el contrato de arrendamiento.",
  netAmount: "0",
  vatAmount: "0",
  irpfAmount: "0",
  iban: "ES00 0000 0000 0000 0000 0000",
  paymentMethod: "Transferencia bancaria",
  note: "Nota o condiciones fiscales aplicables.",
}

function euro(value: string) {
  return `${Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function displayDate(value: string) {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export function InvoiceTemplateEditor() {
  const [formData, setFormData] = useState<InvoiceTemplateData>(DEFAULT_TEMPLATE)
  const total = useMemo(() => {
    return Number(formData.netAmount || 0) + Number(formData.vatAmount || 0) - Number(formData.irpfAmount || 0)
  }, [formData.netAmount, formData.vatAmount, formData.irpfAmount])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) setFormData({ ...DEFAULT_TEMPLATE, ...JSON.parse(saved) })
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  function setField(key: keyof InvoiceTemplateData, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function saveTemplate() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formData))
    alert("Factura guardada en el programa.")
  }

  function exportPdf() {
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.setTextColor(15, 23, 42)
    doc.text("FACTURA", 14, 20)

    doc.setFontSize(10)
    doc.setTextColor(71, 85, 105)
    doc.text(`Nº FACTURA: ${formData.invoiceNumber}`, 14, 30)
    doc.text(`FECHA: ${displayDate(formData.date)}`, 14, 36)

    autoTable(doc, {
      startY: 46,
      head: [["Datos del arrendador", "Datos del arrendatario"]],
      body: [
        [`Nombre: ${formData.landlordName}`, `Empresa/Nombre: ${formData.tenantName}`],
        [`NIF/CIF: ${formData.landlordTaxId}`, `NIF/CIF: ${formData.tenantTaxId}`],
        [`Dirección: ${formData.landlordAddress}`, `Dirección: ${formData.tenantAddress}`],
        [`Email: ${formData.landlordEmail}`, `Email: ${formData.tenantEmail}`],
      ],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
    })

    const firstTableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text("CONCEPTO", 14, firstTableEnd + 14)
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text(doc.splitTextToSize(formData.concept, 180), 14, firstTableEnd + 22)

    autoTable(doc, {
      startY: firstTableEnd + 48,
      body: [
        ["Importe neto", euro(formData.netAmount)],
        ["IVA", euro(formData.vatAmount)],
        ["Retención IRPF", euro(formData.irpfAmount)],
        ["Total a pagar", euro(String(total))],
      ],
      theme: "striped",
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    })

    const secondTableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    doc.setFontSize(10)
    doc.text(`Forma de pago: ${formData.paymentMethod}`, 14, secondTableEnd + 14)
    doc.text(`IBAN: ${formData.iban}`, 14, secondTableEnd + 20)
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(doc.splitTextToSize(`NOTA: ${formData.note}`, 180), 14, secondTableEnd + 32)

    doc.save(`Factura_${formData.invoiceNumber.replace(/[^\w-]+/g, "_")}.pdf`)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Factura editable de alquiler</h2>
            <p className="text-sm text-slate-500">Plantilla creada desde el DOCX adjunto.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={DOCX_URL}
              download
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> DOCX plantilla
            </a>
            <Button type="button" variant="outline" onClick={saveTemplate} className="gap-2">
              <Save className="w-4 h-4" /> Guardar
            </Button>
            <Button type="button" onClick={exportPdf} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Nº factura</Label>
            <Input value={formData.invoiceNumber} onChange={(e) => setField("invoiceNumber", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Input type="date" value={formData.date} onChange={(e) => setField("date", e.target.value)} />
          </div>

          <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl border bg-slate-50 p-4 grid gap-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Arrendador</p>
              <Input value={formData.landlordName} onChange={(e) => setField("landlordName", e.target.value)} placeholder="Nombre" />
              <Input value={formData.landlordTaxId} onChange={(e) => setField("landlordTaxId", e.target.value)} placeholder="NIF/CIF" />
              <Input value={formData.landlordAddress} onChange={(e) => setField("landlordAddress", e.target.value)} placeholder="Dirección" />
              <Input value={formData.landlordEmail} onChange={(e) => setField("landlordEmail", e.target.value)} placeholder="Email" />
            </section>

            <section className="rounded-xl border bg-slate-50 p-4 grid gap-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Arrendatario</p>
              <Input value={formData.tenantName} onChange={(e) => setField("tenantName", e.target.value)} placeholder="Empresa o nombre" />
              <Input value={formData.tenantTaxId} onChange={(e) => setField("tenantTaxId", e.target.value)} placeholder="NIF/CIF" />
              <Input value={formData.tenantAddress} onChange={(e) => setField("tenantAddress", e.target.value)} placeholder="Dirección" />
              <Input value={formData.tenantEmail} onChange={(e) => setField("tenantEmail", e.target.value)} placeholder="Email" />
            </section>
          </div>

          <div className="md:col-span-2 grid gap-2">
            <Label>Concepto</Label>
            <textarea
              value={formData.concept}
              onChange={(e) => setField("concept", e.target.value)}
              className="min-h-[110px] rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="grid gap-2">
            <Label>Importe neto (€)</Label>
            <Input type="number" step="0.01" value={formData.netAmount} onChange={(e) => setField("netAmount", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>IVA (€)</Label>
            <Input type="number" step="0.01" value={formData.vatAmount} onChange={(e) => setField("vatAmount", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Retención IRPF (€)</Label>
            <Input type="number" step="0.01" value={formData.irpfAmount} onChange={(e) => setField("irpfAmount", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Total a pagar</Label>
            <Input value={euro(String(total))} disabled className="font-black text-blue-700" />
          </div>
          <div className="grid gap-2">
            <Label>Forma de pago</Label>
            <Input value={formData.paymentMethod} onChange={(e) => setField("paymentMethod", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>IBAN</Label>
            <Input value={formData.iban} onChange={(e) => setField("iban", e.target.value)} />
          </div>
          <div className="md:col-span-2 grid gap-2">
            <Label>Nota</Label>
            <Input value={formData.note} onChange={(e) => setField("note", e.target.value)} />
          </div>
        </div>
      </div>

      <aside className="bg-white rounded-xl border shadow-sm p-6 h-fit">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Vista rápida</p>
        <div className="border rounded-lg p-4 font-mono text-xs text-slate-700 space-y-3">
          <div>
            <p className="font-black text-lg text-slate-900">FACTURA</p>
            <p>Nº {formData.invoiceNumber}</p>
            <p>{displayDate(formData.date)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-bold">Arrendador</p>
              <p>{formData.landlordName}</p>
              <p>{formData.landlordTaxId}</p>
            </div>
            <div>
              <p className="font-bold">Arrendatario</p>
              <p>{formData.tenantName}</p>
              <p>{formData.tenantTaxId}</p>
            </div>
          </div>
          <p>{formData.concept}</p>
          <div className="border-t pt-3 space-y-1">
            <p className="flex justify-between"><span>Importe neto</span><strong>{euro(formData.netAmount)}</strong></p>
            <p className="flex justify-between"><span>IVA</span><strong>{euro(formData.vatAmount)}</strong></p>
            <p className="flex justify-between"><span>IRPF</span><strong>{euro(formData.irpfAmount)}</strong></p>
            <p className="flex justify-between text-base text-blue-700"><span>Total</span><strong>{euro(String(total))}</strong></p>
          </div>
        </div>
      </aside>
    </div>
  )
}
