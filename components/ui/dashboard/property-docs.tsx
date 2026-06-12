"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Download, FileText, ImageIcon, Trash2, UploadCloud, Video } from "lucide-react"
import { getStorageDisplayUrl } from "@/lib/storage"

type PropertyDocumentRow = {
  id: string | number
  name: string
  url: string | null
  type?: string | null
  displayUrl?: string | null
}

function getFileKind(doc: PropertyDocumentRow) {
  const value = `${doc.type || ""} ${doc.name || ""} ${doc.url || ""}`.toLowerCase()

  if (/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(value) || ["png", "jpg", "jpeg", "webp", "gif", "avif"].some((ext) => value.includes(ext))) {
    return "image"
  }

  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(value) || ["mp4", "webm", "mov", "m4v"].some((ext) => value.includes(ext))) {
    return "video"
  }

  return "document"
}

export function PropertyDocs({ propertyId, onChange }: { propertyId: string; onChange?: () => void }) {
  const [docs, setDocs] = useState<PropertyDocumentRow[]>([])
  const [uploading, setUploading] = useState(false)

  async function fetchDocs() {
    const { data } = await supabase
      .from("property_documents")
      .select("*")
      .eq("property_id", propertyId)

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

  useEffect(() => {
    fetchDocs()
  }, [propertyId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)
      const file = e.target.files?.[0]
      if (!file) return

      const fileExt = file.name.split(".").pop() || "file"
      const fileName = `${crypto.randomUUID?.() || Math.random()}.${fileExt}`
      const filePath = `${propertyId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("property-docs")
        .upload(filePath, file, {
          contentType: file.type || undefined,
        })

      if (uploadError) throw uploadError

      await supabase.from("property_documents").insert({
        property_id: propertyId,
        name: file.name,
        url: filePath,
        type: file.type || fileExt,
      })

      await fetchDocs()
      onChange?.()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "No se pudo subir el archivo.")
    } finally {
      setUploading(false)
      e.currentTarget.value = ""
    }
  }

  async function handleDelete(doc: PropertyDocumentRow) {
    if (!window.confirm(`Eliminar "${doc.name}" del expediente?`)) return

    const { error } = await supabase.from("property_documents").delete().eq("id", doc.id)
    if (error) {
      alert("Error al eliminar: " + error.message)
      return
    }

    if (doc.url) {
      await supabase.storage.from("property-docs").remove([doc.url]).catch(() => null)
    }

    await fetchDocs()
    onChange?.()
  }

  return (
    <div className="space-y-4 rounded-lg border bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase text-slate-700">Fotos, videos y documentacion</h3>
        <label className="flex cursor-pointer items-center gap-2 rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">
          <UploadCloud className="h-3 w-3" />
          {uploading ? "Subiendo..." : "Subir archivo"}
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
        </label>
      </div>

      <div className="grid gap-3">
        {docs.length === 0 && <p className="text-xs italic text-slate-400">No hay archivos cargados.</p>}

        {docs.map((doc) => {
          const kind = getFileKind(doc)

          return (
            <div key={doc.id} className="overflow-hidden rounded border bg-white text-sm shadow-sm">
              {kind === "image" && doc.displayUrl && (
                <img src={doc.displayUrl} alt={doc.name} className="h-36 w-full object-cover" />
              )}
              {kind === "video" && doc.displayUrl && (
                <video src={doc.displayUrl} className="h-36 w-full bg-black object-cover" controls preload="metadata" />
              )}

              <div className="flex items-center justify-between gap-2 p-2">
                <div className="flex min-w-0 items-center gap-2">
                  {kind === "image" ? (
                    <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
                  ) : kind === "video" ? (
                    <Video className="h-4 w-4 shrink-0 text-blue-500" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                  )}
                  <span className="truncate">{doc.name}</span>
                </div>

                <div className="flex shrink-0 gap-2">
                  {doc.displayUrl && (
                    <a href={doc.displayUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600" title="Abrir o descargar">
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  <button type="button" onClick={() => handleDelete(doc)} className="text-slate-400 hover:text-red-600" title="Eliminar archivo">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
