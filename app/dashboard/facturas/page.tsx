import { InvoiceTemplateEditor } from "@/components/ui/dashboard/invoice-template-editor"
import { FileText } from "lucide-react"

export default function FacturasPage() {
  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
          <FileText className="w-7 h-7 text-blue-600" />
          Facturas
        </h1>
        <p className="text-slate-500 mt-2">
          Edita la factura de alquiler cargada desde el DOCX y exporta una copia en PDF cuando un inquilino la pida.
        </p>
      </div>

      <InvoiceTemplateEditor />
    </div>
  )
}
