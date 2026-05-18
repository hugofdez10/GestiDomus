"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, Download, Trash2, UploadCloud } from "lucide-react"
import { getStorageDisplayUrl } from "@/lib/storage"

type PropertyDocumentRow = {
  id: string | number
  name: string
  url: string | null
  type?: string | null
  displayUrl?: string | null
}

export function PropertyDocs({ propertyId }: { propertyId: string }) {
  const [docs, setDocs] = useState<PropertyDocumentRow[]>([])
  const [uploading, setUploading] = useState(false)

  async function fetchDocs() {
    const { data } = await supabase
      .from('property_documents')
      .select('*')
      .eq('property_id', propertyId)
    if (data) {
      const docsWithUrls = await Promise.all(
        (data as PropertyDocumentRow[]).map(async (doc) => ({
          ...doc,
          displayUrl: await getStorageDisplayUrl(supabase, "property-docs", doc.url).catch(() => null),
        }))
      )
      setDocs(docsWithUrls)
    }
  }

  useEffect(() => { fetchDocs() }, [propertyId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)
      const file = e.target.files?.[0]
      if (!file) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${propertyId}/${fileName}`

      // 1. Subir al Storage
      const { error: uploadError } = await supabase.storage
        .from('property-docs')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      await supabase.from('property_documents').insert({
        property_id: propertyId,
        name: file.name,
        url: filePath,
        type: fileExt
      })

      fetchDocs()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 uppercase">Documentación</h3>
        <label className="cursor-pointer bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 flex items-center gap-2">
          <UploadCloud className="w-3 h-3" />
          {uploading ? "Subiendo..." : "Subir PDF"}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".pdf,.jpg,.png" />
        </label>
      </div>

      <div className="grid gap-2">
        {docs.length === 0 && <p className="text-xs text-slate-400 italic">No hay documentos cargados.</p>}
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm text-sm">
            <div className="flex items-center gap-2 truncate">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="truncate max-w-[150px]">{doc.name}</span>
            </div>
            <div className="flex gap-2">
              {doc.displayUrl && (
                <a href={doc.displayUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600">
                <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
