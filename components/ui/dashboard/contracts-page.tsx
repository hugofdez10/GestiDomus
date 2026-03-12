"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Search,
  FileText,
  Eye,
  Pencil,
  Save,
  UploadCloud,
  FileSignature,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { supabase } from "@/utils/supabase/client"

type ContractStatus =
  | "borrador"
  | "pendiente_firma"
  | "activo"
  | "vencido"
  | "rescindido"

type DepositStatus =
  | "pendiente"
  | "parcial"
  | "devuelta"
  | "retenida"

type ContractRow = {
  id: string | number
  tenant_id?: number | null
  property: string
  tenant: string
  email: string
  phone: string
  contractName: string
  depositStatus: DepositStatus
  depositAmount: number
  depositReturnedAmount: number
  contractStart: string
  contractEnd: string
  contractStatus: ContractStatus
  contractUrl?: string
}

function formatDate(dateString: string) {
  if (!dateString) return "—"

  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function getContractStatusLabel(status: ContractStatus) {
  switch (status) {
    case "pendiente_firma":
      return "Pendiente firma"
    case "activo":
      return "Activo"
    case "borrador":
      return "Borrador"
    case "vencido":
      return "Vencido"
    case "rescindido":
      return "Rescindido"
    default:
      return status
  }
}

function getDepositStatusLabel(status: DepositStatus) {
  switch (status) {
    case "pendiente":
      return "Pendiente"
    case "parcial":
      return "Devuelta parcial"
    case "devuelta":
      return "Devuelta total"
    case "retenida":
      return "Retenida"
    default:
      return status
  }
}

function getContractStatusClasses(status: ContractStatus) {
  switch (status) {
    case "activo":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "pendiente_firma":
      return "bg-amber-100 text-amber-700 border-amber-200"
    case "borrador":
      return "bg-slate-100 text-slate-700 border-slate-200"
    case "vencido":
      return "bg-orange-100 text-orange-700 border-orange-200"
    case "rescindido":
      return "bg-red-100 text-red-700 border-red-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function getDepositStatusClasses(status: DepositStatus) {
  switch (status) {
    case "devuelta":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "pendiente":
      return "bg-amber-100 text-amber-700 border-amber-200"
    case "parcial":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "retenida":
      return "bg-red-100 text-red-700 border-red-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function normalizeDepositStatus(depositAmount: number, returnedAmount: number, currentStatus: DepositStatus): DepositStatus {
  const total = Number(depositAmount || 0)
  const returned = Number(returnedAmount || 0)

  if (currentStatus === "retenida") return "retenida"
  if (returned <= 0) return "pendiente"
  if (returned >= total && total > 0) return "devuelta"
  if (returned > 0 && returned < total) return "parcial"
  return currentStatus
}

export function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [search, setSearch] = useState("")
  const [contractStatusFilter, setContractStatusFilter] = useState<string>("all")
  const [depositStatusFilter, setDepositStatusFilter] = useState<string>("all")

  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")

  const [saving, setSaving] = useState(false)
  const [deletingPdf, setDeletingPdf] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  async function loadContracts() {
    const { data, error } = await supabase
      .from("contracts_overview")
      .select("*")
      .order("property_name", { ascending: true })

    if (error) {
      console.error("Error cargando contratos:", error)
      alert("Error cargando contratos: " + error.message)
      return
    }

    const mapped: ContractRow[] = (data ?? []).map((c: any) => ({
      id: c.id,
      tenant_id: c.tenant_id ?? null,
      property: c.property_name ?? "—",
      tenant: c.tenant_name ?? "—",
      email: c.tenant_email ?? "",
      phone: c.tenant_phone ?? "",
      contractName: c.contract_code ?? "",
      depositStatus: c.deposit_status ?? "pendiente",
      depositAmount: Number(c.deposit_amount ?? 0),
      depositReturnedAmount: Number(c.deposit_returned_amount ?? 0),
      contractStart: c.start_date ?? "",
      contractEnd: c.end_date ?? "",
      contractStatus: c.contract_status ?? "borrador",
      contractUrl: c.document_path ?? "",
    }))

    setContracts(mapped)
  }

  useEffect(() => {
    loadContracts()
  }, [])

  const filteredContracts = useMemo(() => {
    return contracts
      .filter((item) => {
        const normalizedSearch = search.trim().toLowerCase()

        const matchesSearch =
          normalizedSearch.length === 0 ||
          item.property.toLowerCase().includes(normalizedSearch) ||
          item.tenant.toLowerCase().includes(normalizedSearch) ||
          item.email.toLowerCase().includes(normalizedSearch) ||
          item.phone.toLowerCase().includes(normalizedSearch) ||
          item.contractName.toLowerCase().includes(normalizedSearch)

        const matchesContractStatus =
          contractStatusFilter === "all" || item.contractStatus === contractStatusFilter

        const matchesDepositStatus =
          depositStatusFilter === "all" || item.depositStatus === depositStatusFilter

        return matchesSearch && matchesContractStatus && matchesDepositStatus
      })
      .sort((a, b) =>
        a.property.localeCompare(b.property, "es", { sensitivity: "base" })
      )
  }, [contracts, search, contractStatusFilter, depositStatusFilter])

  const activeCount = contracts.filter((c) => c.contractStatus === "activo").length
  const pendingSignatureCount = contracts.filter((c) => c.contractStatus === "pendiente_firma").length
  const depositPendingCount = contracts.filter((c) => c.depositStatus === "pendiente" || c.depositStatus === "parcial").length

  function openEditModal(contract: ContractRow) {
    setSelectedContract({ ...contract })
    setPdfFile(null)
    setEditOpen(true)
  }

  function openPreview(url?: string) {
    if (!url) {
      alert("Este contrato no tiene documento adjunto.")
      return
    }

    setPreviewUrl(url)
    setPreviewOpen(true)
  }

  function updateSelectedField<K extends keyof ContractRow>(field: K, value: ContractRow[K]) {
    if (!selectedContract) return

    const updated = {
      ...selectedContract,
      [field]: value,
    }

    if (field === "depositAmount" || field === "depositReturnedAmount") {
      updated.depositStatus = normalizeDepositStatus(
        Number(updated.depositAmount || 0),
        Number(updated.depositReturnedAmount || 0),
        updated.depositStatus
      )
    }

    setSelectedContract(updated)
  }

  async function uploadPdf(contractId: string | number, file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase()

    if (extension !== "pdf") {
      throw new Error("Solo se permiten archivos PDF.")
    }

    const fileName = `contract-${contractId}-${Date.now()}.pdf`
    const filePath = `contracts/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from("vault")
      .upload(filePath, file, {
        upsert: true,
        contentType: "application/pdf",
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from("vault").getPublicUrl(filePath)
    return data.publicUrl
  }

  async function handleDeletePdf() {
    if (!selectedContract || !selectedContract.contractUrl) return

    try {
      setDeletingPdf(true)

      const { error } = await supabase
        .from("contracts")
        .update({ document_path: null })
        .eq("id", selectedContract.id)

      if (error) throw error

      setSelectedContract({
        ...selectedContract,
        contractUrl: "",
      })

      if (previewUrl === selectedContract.contractUrl) {
        setPreviewOpen(false)
        setPreviewUrl("")
      }

      await loadContracts()
    } catch (error: any) {
      alert("Error al borrar el PDF: " + error.message)
    } finally {
      setDeletingPdf(false)
    }
  }

  async function handleSave() {
    if (!selectedContract) return

    try {
      setSaving(true)

      if (selectedContract.depositReturnedAmount > selectedContract.depositAmount) {
        alert("El importe devuelto no puede ser mayor que la fianza total.")
        setSaving(false)
        return
      }

      let finalDocumentUrl = selectedContract.contractUrl || null

      if (pdfFile) {
        finalDocumentUrl = await uploadPdf(selectedContract.id, pdfFile)
      }

      const finalDepositStatus = normalizeDepositStatus(
        Number(selectedContract.depositAmount || 0),
        Number(selectedContract.depositReturnedAmount || 0),
        selectedContract.depositStatus
      )

      if (selectedContract.tenant_id) {
        const { error: tenantError } = await supabase
          .from("tenants")
          .update({
            full_name: selectedContract.tenant,
            email: selectedContract.email || null,
            phone: selectedContract.phone || null,
          })
          .eq("id", selectedContract.tenant_id)

        if (tenantError) throw tenantError
      }

      const { error: contractError } = await supabase
        .from("contracts")
        .update({
          contract_code: selectedContract.contractName || null,
          deposit_status: finalDepositStatus,
          deposit_amount: Number(selectedContract.depositAmount || 0),
          deposit_returned_amount: Number(selectedContract.depositReturnedAmount || 0),
          start_date: selectedContract.contractStart || null,
          end_date: selectedContract.contractEnd || null,
          contract_status: selectedContract.contractStatus,
          document_path: finalDocumentUrl,
        })
        .eq("id", selectedContract.id)

      if (contractError) throw contractError

      setEditOpen(false)
      setSelectedContract(null)
      setPdfFile(null)
      await loadContracts()
    } catch (error: any) {
      alert("Error al guardar: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen w-full">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Contratos
          </h1>
          <p className="text-slate-500 font-medium mt-2">
            Control de contratos, estados, fianzas y documentos PDF.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="bg-white border rounded-xl px-4 py-3 shadow-sm min-w-[150px]">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
              <FileSignature className="w-4 h-4" />
              Activos
            </div>
            <p className="text-2xl font-black text-slate-900">{activeCount}</p>
          </div>

          <div className="bg-white border rounded-xl px-4 py-3 shadow-sm min-w-[150px]">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
              Pend. firma
            </div>
            <p className="text-2xl font-black text-amber-600">{pendingSignatureCount}</p>
          </div>

          <div className="bg-white border rounded-xl px-4 py-3 shadow-sm min-w-[150px]">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
              <ShieldCheck className="w-4 h-4" />
              Fianzas
            </div>
            <p className="text-2xl font-black text-red-600">{depositPendingCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b bg-white">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Listado de contratos</h2>
              <p className="text-sm text-slate-500 mt-1">
                Vista compacta con edición y visor PDF integrado.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                setContractStatusFilter("all")
                setDepositStatusFilter("all")
              }}
            >
              Limpiar filtros
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por inmueble, inquilino, email, teléfono o contrato..."
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>

            <div className="lg:col-span-3">
              <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Estado del contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los contratos</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="pendiente_firma">Pendiente firma</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="rescindido">Rescindido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-3">
              <Select value={depositStatusFilter} onValueChange={setDepositStatusFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Estado de la fianza" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fianzas</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="parcial">Devuelta parcial</SelectItem>
                  <SelectItem value="devuelta">Devuelta total</SelectItem>
                  <SelectItem value="retenida">Retenida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Inmueble</TableHead>
                <TableHead>Inquilino</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Fianza</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                    No hay contratos que coincidan con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContracts.map((contract) => (
                  <TableRow key={contract.id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell>
                      <p className="font-semibold text-slate-800">{contract.property}</p>
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-700">{contract.tenant}</p>
                        <p className="text-xs text-slate-500">{contract.email || "Sin email"}</p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-slate-700">
                          {contract.contractName || "Sin código"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm text-slate-600">
                        <p>{formatDate(contract.contractStart)}</p>
                        <p>{formatDate(contract.contractEnd)}</p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className={getDepositStatusClasses(contract.depositStatus)}>
                          {getDepositStatusLabel(contract.depositStatus)}
                        </Badge>
                        <p className="text-xs text-slate-500">
                          {formatCurrency(contract.depositReturnedAmount)} / {formatCurrency(contract.depositAmount)}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className={getContractStatusClasses(contract.contractStatus)}>
                        {getContractStatusLabel(contract.contractStatus)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(contract)}>
                          <Pencil className="w-4 h-4" />
                          Editar
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPreview(contract.contractUrl)}
                          disabled={!contract.contractUrl}
                        >
                          <Eye className="w-4 h-4" />
                          Ver PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="lg:hidden p-4 space-y-4">
          {filteredContracts.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              No hay contratos que coincidan con los filtros actuales.
            </div>
          ) : (
            filteredContracts.map((contract) => (
              <div key={contract.id} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{contract.property}</p>
                    <p className="text-sm text-slate-600">{contract.tenant}</p>
                  </div>

                  <Button variant="outline" size="sm" onClick={() => openEditModal(contract)}>
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={getContractStatusClasses(contract.contractStatus)}>
                    {getContractStatusLabel(contract.contractStatus)}
                  </Badge>

                  <Badge variant="outline" className={getDepositStatusClasses(contract.depositStatus)}>
                    {getDepositStatusLabel(contract.depositStatus)}
                  </Badge>
                </div>

                <div className="text-sm text-slate-600 space-y-1">
                  <p><strong>Contrato:</strong> {contract.contractName || "Sin código"}</p>
                  <p><strong>Inicio:</strong> {formatDate(contract.contractStart)}</p>
                  <p><strong>Fin:</strong> {formatDate(contract.contractEnd)}</p>
                  <p><strong>Fianza:</strong> {formatCurrency(contract.depositReturnedAmount)} / {formatCurrency(contract.depositAmount)}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openPreview(contract.contractUrl)}
                  disabled={!contract.contractUrl}
                >
                  <Eye className="w-4 h-4" />
                  Ver PDF
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar contrato</DialogTitle>
          </DialogHeader>

          {selectedContract && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700 mb-1 block">Inmueble</label>
                <Input value={selectedContract.property} disabled />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Inquilino</label>
                <Input
                  value={selectedContract.tenant}
                  onChange={(e) => updateSelectedField("tenant", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Código de contrato</label>
                <Input
                  value={selectedContract.contractName}
                  onChange={(e) => updateSelectedField("contractName", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
                <Input
                  type="email"
                  value={selectedContract.email}
                  onChange={(e) => updateSelectedField("email", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Teléfono</label>
                <Input
                  value={selectedContract.phone}
                  onChange={(e) => updateSelectedField("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Inicio de contrato</label>
                <Input
                  type="date"
                  value={selectedContract.contractStart || ""}
                  onChange={(e) => updateSelectedField("contractStart", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Fin de contrato</label>
                <Input
                  type="date"
                  value={selectedContract.contractEnd || ""}
                  onChange={(e) => updateSelectedField("contractEnd", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Fianza total (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={selectedContract.depositAmount}
                  onChange={(e) => updateSelectedField("depositAmount", Number(e.target.value || 0))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Importe devuelto (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={selectedContract.depositReturnedAmount}
                  onChange={(e) => updateSelectedField("depositReturnedAmount", Number(e.target.value || 0))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Estado de la fianza</label>
                <Select
                  value={selectedContract.depositStatus}
                  onValueChange={(value: DepositStatus) => updateSelectedField("depositStatus", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="parcial">Devuelta parcial</SelectItem>
                    <SelectItem value="devuelta">Devuelta total</SelectItem>
                    <SelectItem value="retenida">Retenida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <div className="w-full rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                  <p><strong>Resumen:</strong></p>
                  <p>Total: {formatCurrency(selectedContract.depositAmount)}</p>
                  <p>Devuelto: {formatCurrency(selectedContract.depositReturnedAmount)}</p>
                  <p>Pendiente: {formatCurrency(Math.max(0, selectedContract.depositAmount - selectedContract.depositReturnedAmount))}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Estado del contrato</label>
                <Select
                  value={selectedContract.contractStatus}
                  onValueChange={(value: ContractStatus) => updateSelectedField("contractStatus", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrador">Borrador</SelectItem>
                    <SelectItem value="pendiente_firma">Pendiente firma</SelectItem>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="rescindido">Rescindido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 border rounded-xl p-4 bg-slate-50">
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-blue-600" />
                  Adjuntar PDF del contrato
                </label>

                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="bg-white"
                />

                <p className="text-xs text-slate-500 mt-2">
                  Solo PDF. Se guardará en Supabase Storage y se vinculará al contrato.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openPreview(selectedContract.contractUrl)}
                    disabled={!selectedContract.contractUrl}
                  >
                    <Eye className="w-4 h-4" />
                    Ver PDF actual
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeletePdf}
                    disabled={!selectedContract.contractUrl || deletingPdf}
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingPdf ? "Borrando PDF..." : "Borrar PDF actual"}
                  </Button>
                </div>
              </div>

              <div className="md:col-span-2 flex flex-col sm:flex-row gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4" />
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-6xl h-[90vh] p-4">
          <DialogHeader>
            <DialogTitle>Vista previa del contrato</DialogTitle>
          </DialogHeader>

          <div className="w-full h-full border rounded-lg overflow-hidden bg-slate-100">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title="Vista previa del contrato"
                className="w-full h-[78vh] bg-white"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                No hay documento para mostrar.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}