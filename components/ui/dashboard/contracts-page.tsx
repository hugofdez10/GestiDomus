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
  Clock,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { AddContractForm } from "@/components/ui/dashboard/add-contract-form"
import { GenerateMonthlyInvoicesButton } from "@/components/ui/dashboard/generate-monthly-invoices-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/utils/supabase/client"
import { deleteContract } from "@/lib/deleteContract"

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ContractStatus =
  | "borrador"
  | "pendiente_firma"
  | "activo"
  | "vencido"
  | "rescindido"
  | "prorrogado"

type DepositStatus =
  | "pendiente"
  | "parcial"
  | "devuelta"
  | "retenida"

type ContractDbStatus =
  | "draft"
  | "sent"
  | "signed"
  | "active"
  | "expired"
  | "terminated"
  | "renewed"
  | "borrador"
  | "pendiente_firma"
  | "activo"
  | "vencido"
  | "rescindido"
  | "prorrogado"

type DepositDbStatus =
  | "pending"
  | "received"
  | "returned"
  | "partially_returned"
  | "withheld"
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

// ─── Mapeos estado DB <-> UI ──────────────────────────────────────────────────
function normalizeContractStatusFromDb(value?: ContractDbStatus): ContractStatus {
  switch (value) {
    case "draft":
    case "borrador":
      return "borrador"
    case "sent":
    case "pendiente_firma":
      return "pendiente_firma"
    case "signed":
    case "active":
    case "activo":
      return "activo"
    case "expired":
    case "vencido":
      return "vencido"
    case "terminated":
    case "rescindido":
      return "rescindido"
    case "renewed":
    case "prorrogado":
      return "prorrogado"
    default:
      return "borrador"
  }
}

function normalizeDepositStatusFromDb(value?: DepositDbStatus): DepositStatus {
  switch (value) {
    case "pending":
    case "received":
    case "pendiente":
      return "pendiente"
    case "partially_returned":
    case "parcial":
      return "parcial"
    case "returned":
    case "devuelta":
      return "devuelta"
    case "withheld":
    case "retenida":
      return "retenida"
    default:
      return "pendiente"
  }
}

function mapContractStatusToDb(status: ContractStatus): ContractDbStatus {
  switch (status) {
    case "borrador":
      return "borrador"
    case "pendiente_firma":
      return "pendiente_firma"
    case "activo":
      return "activo"
    case "vencido":
      return "vencido"
    case "rescindido":
      return "rescindido"
    case "prorrogado":
      return "prorrogado"
    default:
      return "borrador"
  }
}

function mapDepositStatusToDb(status: DepositStatus): DepositDbStatus {
  switch (status) {
    case "pendiente":
      return "pendiente"
    case "parcial":
      return "parcial"
    case "devuelta":
      return "devuelta"
    case "retenida":
      return "retenida"
    default:
      return "pendiente"
  }
}

// ─── Utilidades de formato ────────────────────────────────────────────────────
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

function calcDurationMonths(start: string, end: string): number | null {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

// ─── Labels y colores ─────────────────────────────────────────────────────────
function getContractStatusLabel(status: ContractStatus) {
  const map: Record<ContractStatus, string> = {
    pendiente_firma: "Pendiente firma",
    activo: "Activo",
    borrador: "Borrador",
    vencido: "Vencido",
    rescindido: "Rescindido",
    prorrogado: "Prorrogado",
  }
  return map[status] ?? status
}

function getDepositStatusLabel(status: DepositStatus) {
  const map: Record<DepositStatus, string> = {
    pendiente: "Pendiente",
    parcial: "Devuelta parcial",
    devuelta: "Fianza devuelta",
    retenida: "Fianza retenida",
  }
  return map[status] ?? status
}

function getAutoContractStatus(row: ContractRow): ContractStatus {
  if (["prorrogado", "rescindido", "borrador", "pendiente_firma"].includes(row.contractStatus)) {
    return row.contractStatus
  }

  if (!row.contractEnd) return row.contractStatus

  const end = new Date(row.contractEnd)
  const now = new Date()
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "vencido"
  return "activo"
}

function getContractStatusClasses(status: ContractStatus) {
  const map: Record<ContractStatus, string> = {
    activo: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pendiente_firma: "bg-amber-100 text-amber-700 border-amber-200",
    borrador: "bg-slate-100 text-slate-700 border-slate-200",
    vencido: "bg-orange-100 text-orange-700 border-orange-200",
    rescindido: "bg-red-100 text-red-700 border-red-200",
    prorrogado: "bg-purple-100 text-purple-700 border-purple-200",
  }
  return map[status] ?? "bg-slate-100 text-slate-700"
}

function getDepositStatusClasses(status: DepositStatus) {
  const map: Record<DepositStatus, string> = {
    devuelta: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pendiente: "bg-amber-100 text-amber-700 border-amber-200",
    parcial: "bg-blue-100 text-blue-700 border-blue-200",
    retenida: "bg-red-100 text-red-700 border-red-200",
  }
  return map[status] ?? "bg-slate-100 text-slate-700"
}

function normalizeDepositStatus(
  depositAmount: number,
  returnedAmount: number,
  currentStatus: DepositStatus
): DepositStatus {
  const total = Number(depositAmount || 0)
  const returned = Number(returnedAmount || 0)

  if (currentStatus === "retenida") return "retenida"
  if (returned <= 0) return "pendiente"
  if (returned >= total && total > 0) return "devuelta"
  if (returned > 0 && returned < total) return "parcial"
  return currentStatus
}

// Opciones duración
const CONTRACT_DURATIONS = [
  { label: "6 meses", value: 6 },
  { label: "11 meses", value: 11 },
  { label: "12 meses (1 año)", value: 12 },
  { label: "24 meses (2 años)", value: 24 },
  { label: "36 meses (3 años)", value: 36 },
  { label: "60 meses (5 años)", value: 60 },
  { label: "Personalizado", value: 0 },
]

// ─── Helpers relaciones Supabase ──────────────────────────────────────────────
function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

// ─── Componente principal ─────────────────────────────────────────────────────
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
  const [deletingContractId, setDeletingContractId] = useState<string | number | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const [editDuration, setEditDuration] = useState<string>("0")
  const [editCustomDuration, setEditCustomDuration] = useState<string>("")

  async function loadContracts() {
    const { data, error } = await supabase
      .from("contracts")
      .select(`
        id,
        tenant_id,
        property_id,
        contract_code,
        deposit_status,
        deposit_amount,
        deposit_returned_amount,
        start_date,
        end_date,
        contract_status,
        document_path,
        properties(name),
        tenants(full_name, email, phone)
      `)
      .order("start_date", { ascending: false })

    if (error) {
      alert("Error cargando contratos: " + error.message)
      return
    }

    const mapped: ContractRow[] = (data ?? []).map((c: any) => {
      const propertyRel = getSingleRelation(c.properties)
      const tenantRel = getSingleRelation(c.tenants)

      return {
        id: c.id,
        tenant_id: c.tenant_id ?? null,
        property: propertyRel?.name ?? "—",
        tenant: tenantRel?.full_name ?? "—",
        email: tenantRel?.email ?? "",
        phone: tenantRel?.phone ?? "",
        contractName: c.contract_code ?? "",
        depositStatus: normalizeDepositStatusFromDb(c.deposit_status),
        depositAmount: Number(c.deposit_amount ?? 0),
        depositReturnedAmount: Number(c.deposit_returned_amount ?? 0),
        contractStart: c.start_date ?? "",
        contractEnd: c.end_date ?? "",
        contractStatus: normalizeContractStatusFromDb(c.contract_status),
        contractUrl: c.document_path ?? "",
      }
    })

    setContracts(mapped)
  }

  useEffect(() => {
    loadContracts()
  }, [])

  const filteredContracts = useMemo(() => {
    return contracts
      .filter((item) => {
        const q = search.trim().toLowerCase()

        const matchSearch =
          !q ||
          item.property.toLowerCase().includes(q) ||
          item.tenant.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q) ||
          item.contractName.toLowerCase().includes(q)

        const effectiveStatus = getAutoContractStatus(item)
        const matchContract = contractStatusFilter === "all" || effectiveStatus === contractStatusFilter
        const matchDeposit = depositStatusFilter === "all" || item.depositStatus === depositStatusFilter

        return matchSearch && matchContract && matchDeposit
      })
      .sort((a, b) => a.property.localeCompare(b.property, "es", { sensitivity: "base" }))
  }, [contracts, search, contractStatusFilter, depositStatusFilter])

  const activeCount = contracts.filter((c) => getAutoContractStatus(c) === "activo").length
  const pendingSignatureCount = contracts.filter((c) => c.contractStatus === "pendiente_firma").length
  const depositPendingCount = contracts.filter((c) => ["pendiente", "parcial"].includes(c.depositStatus)).length
  const prorrogadoCount = contracts.filter((c) => c.contractStatus === "prorrogado").length

  function openEditModal(contract: ContractRow) {
    setSelectedContract({ ...contract })
    setPdfFile(null)
    setEditDuration("0")
    setEditCustomDuration("")
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

    const updated = { ...selectedContract, [field]: value }

    if (field === "depositAmount" || field === "depositReturnedAmount") {
      updated.depositStatus = normalizeDepositStatus(
        Number(updated.depositAmount || 0),
        Number(updated.depositReturnedAmount || 0),
        updated.depositStatus
      )
    }

    setSelectedContract(updated)
  }

  function applyEditDuration(months: number) {
    if (!selectedContract?.contractStart || !months) return
    const start = new Date(selectedContract.contractStart)
    start.setMonth(start.getMonth() + months)
    updateSelectedField("contractEnd", start.toISOString().split("T")[0])
  }

  async function uploadPdf(contractId: string | number, file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase()
    if (extension !== "pdf") {
      throw new Error("Solo se permiten PDF.")
    }

    const filePath = `contracts/contract-${contractId}-${Date.now()}.pdf`

    const { error } = await supabase.storage
      .from("vault")
      .upload(filePath, file, {
        upsert: true,
        contentType: "application/pdf",
      })

    if (error) throw error

    return supabase.storage.from("vault").getPublicUrl(filePath).data.publicUrl
  }

  async function handleDeletePdf() {
    if (!selectedContract?.contractUrl) return

    setDeletingPdf(true)

    try {
      const { error } = await supabase
        .from("contracts")
        .update({ document_path: null })
        .eq("id", selectedContract.id)

      if (error) throw error

      setSelectedContract({ ...selectedContract, contractUrl: "" })
      await loadContracts()
    } catch (e: any) {
      alert("Error al borrar el PDF: " + e.message)
    } finally {
      setDeletingPdf(false)
    }
  }

  async function handleDeleteContract(contract: ContractRow) {
    const ok = window.confirm(
      `¿Seguro que quieres eliminar el contrato ${contract.contractName || ""}?\n\nEsto borrará también recibos y pagos relacionados.`
    )

    if (!ok) return

    try {
      setDeletingContractId(contract.id)
      await deleteContract(String(contract.id))
      await loadContracts()
      alert("Contrato eliminado correctamente.")
    } catch (e: any) {
      alert("Error al eliminar contrato: " + (e?.message || "Sin detalle"))
    } finally {
      setDeletingContractId(null)
    }
  }

  async function handleSave() {
    if (!selectedContract) return

    setSaving(true)

    try {
      if (selectedContract.depositReturnedAmount > selectedContract.depositAmount) {
        alert("El importe devuelto no puede superar la fianza total.")
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
        const { error } = await supabase
          .from("tenants")
          .update({
            full_name: selectedContract.tenant,
            email: selectedContract.email || null,
            phone: selectedContract.phone || null,
          })
          .eq("id", selectedContract.tenant_id)

        if (error) throw error
      }

      const { error } = await supabase
        .from("contracts")
        .update({
          contract_code: selectedContract.contractName || null,
          deposit_status: mapDepositStatusToDb(finalDepositStatus),
          deposit_amount: Number(selectedContract.depositAmount || 0),
          deposit_returned_amount: Number(selectedContract.depositReturnedAmount || 0),
          start_date: selectedContract.contractStart || null,
          end_date: selectedContract.contractEnd || null,
          contract_status: mapContractStatusToDb(selectedContract.contractStatus),
          document_path: finalDocumentUrl,
        })
        .eq("id", selectedContract.id)

      if (error) throw error

      setEditOpen(false)
      setSelectedContract(null)
      setPdfFile(null)
      await loadContracts()
    } catch (e: any) {
      alert("Error al guardar: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen w-full">
      <div className="mb-8 space-y-4">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Contratos
            </h1>
            <p className="text-slate-500 font-medium mt-2">
              Control de contratos, fianzas, recibos y documentos PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AddContractForm onCreated={loadContracts} triggerClassName="shadow-sm" />
            <GenerateMonthlyInvoicesButton onDone={loadContracts} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Activos", value: activeCount, icon: <FileSignature className="w-4 h-4" />, color: "text-slate-900" },
            { label: "Pend. firma", value: pendingSignatureCount, icon: null, color: "text-amber-600" },
            { label: "Prorrogados", value: prorrogadoCount, icon: <Clock className="w-4 h-4" />, color: "text-purple-700" },
            { label: "Fianzas pend.", value: depositPendingCount, icon: <ShieldCheck className="w-4 h-4" />, color: "text-red-600" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border rounded-xl px-4 py-3 shadow-sm min-w-[130px]"
            >
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
                {stat.icon}
                {stat.label}
              </div>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Listado de contratos</h2>
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por inmueble, inquilino, email..."
                className="pl-10 bg-slate-50"
              />
            </div>

            <div className="lg:col-span-3">
              <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
                <SelectTrigger className="bg-slate-50">
                  <SelectValue placeholder="Estado contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los contratos</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="pendiente_firma">Pendiente firma</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="prorrogado">Prorrogado</SelectItem>
                  <SelectItem value="rescindido">Rescindido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-3">
              <Select value={depositStatusFilter} onValueChange={setDepositStatusFilter}>
                <SelectTrigger className="bg-slate-50">
                  <SelectValue placeholder="Estado fianza" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fianzas</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="parcial">Devuelta parcial</SelectItem>
                  <SelectItem value="devuelta">Fianza devuelta</SelectItem>
                  <SelectItem value="retenida">Fianza retenida</SelectItem>
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
                <TableHead>Inicio</TableHead>
                <TableHead>Fin / Duración</TableHead>
                <TableHead>Fianza</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                    No hay contratos con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContracts.map((contract) => {
                  const effectiveStatus = getAutoContractStatus(contract)
                  const duration = calcDurationMonths(contract.contractStart, contract.contractEnd)

                  return (
                    <TableRow key={contract.id} className="hover:bg-slate-50/60">
                      <TableCell>
                        <p className="font-semibold text-slate-800">{contract.property}</p>
                      </TableCell>

                      <TableCell>
                        <p className="font-semibold text-slate-700">{contract.tenant}</p>
                        <p className="text-xs text-slate-400">{contract.phone || "—"}</p>
                        {contract.email ? (
                          <a href={`mailto:${contract.email}`} className="text-xs text-blue-500 hover:underline">
                            {contract.email}
                          </a>
                        ) : (
                          <p className="text-xs text-slate-300 italic">Sin email</p>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-slate-700">
                            {contract.contractName || "Sin código"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-slate-600">
                        {formatDate(contract.contractStart)}
                      </TableCell>

                      <TableCell>
                        <p className="text-sm text-slate-600">{formatDate(contract.contractEnd)}</p>
                        {duration !== null && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{duration} meses</p>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className={getDepositStatusClasses(contract.depositStatus)}>
                          {getDepositStatusLabel(contract.depositStatus)}
                        </Badge>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatCurrency(contract.depositReturnedAmount)} / {formatCurrency(contract.depositAmount)}
                        </p>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className={getContractStatusClasses(effectiveStatus)}>
                          {getContractStatusLabel(effectiveStatus)}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => openEditModal(contract)}>
                            <Pencil className="w-4 h-4" /> Editar
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPreview(contract.contractUrl)}
                            disabled={!contract.contractUrl}
                          >
                            <Eye className="w-4 h-4" /> PDF
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleDeleteContract(contract)}
                            disabled={deletingContractId === contract.id}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingContractId === contract.id ? "Eliminando..." : "Eliminar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="lg:hidden p-4 space-y-4">
          {filteredContracts.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-center text-slate-500 shadow-sm">
              No hay contratos con los filtros actuales.
            </div>
          ) : (
            filteredContracts.map((contract) => {
              const effectiveStatus = getAutoContractStatus(contract)
              const duration = calcDurationMonths(contract.contractStart, contract.contractEnd)

              return (
                <div key={contract.id} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{contract.property}</p>
                      <p className="text-sm text-slate-600">{contract.tenant}</p>
                      {contract.email && <p className="text-xs text-blue-500">{contract.email}</p>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditModal(contract)}>
                        <Pencil className="w-4 h-4" /> Editar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPreview(contract.contractUrl)}
                        disabled={!contract.contractUrl}
                      >
                        <Eye className="w-4 h-4" /> PDF
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleDeleteContract(contract)}
                        disabled={deletingContractId === contract.id}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingContractId === contract.id ? "Eliminando..." : "Eliminar"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={getContractStatusClasses(effectiveStatus)}>
                      {getContractStatusLabel(effectiveStatus)}
                    </Badge>
                    <Badge variant="outline" className={getDepositStatusClasses(contract.depositStatus)}>
                      {getDepositStatusLabel(contract.depositStatus)}
                    </Badge>
                  </div>

                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>Inicio:</strong> {formatDate(contract.contractStart)}</p>
                    <p><strong>Fin:</strong> {formatDate(contract.contractEnd)}{duration !== null ? ` (${duration} meses)` : ""}</p>
                    <p><strong>Fianza:</strong> {formatCurrency(contract.depositReturnedAmount)} / {formatCurrency(contract.depositAmount)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
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

              <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-lg grid gap-3">
                <label className="text-sm font-bold text-blue-800 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Duración del contrato
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    value={editDuration}
                    onValueChange={(val) => {
                      setEditDuration(val)
                      if (val !== "0") applyEditDuration(parseInt(val))
                    }}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Duración..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value.toString()}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {editDuration === "0" && (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Meses"
                        value={editCustomDuration}
                        onChange={(e) => setEditCustomDuration(e.target.value)}
                        className="bg-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => applyEditDuration(parseInt(editCustomDuration))}
                      >
                        Aplicar
                      </Button>
                    </div>
                  )}
                </div>

                {selectedContract.contractStart && selectedContract.contractEnd && (() => {
                  const d = calcDurationMonths(selectedContract.contractStart, selectedContract.contractEnd)
                  return d !== null ? (
                    <p className="text-xs text-blue-600">
                      Duración actual: <strong>{d} meses</strong>
                    </p>
                  ) : null
                })()}
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
                    <SelectItem value="devuelta">✅ Fianza devuelta</SelectItem>
                    <SelectItem value="retenida">🔒 Fianza retenida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <div className="w-full rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                  <p><strong>Resumen fianza:</strong></p>
                  <p>Total: {formatCurrency(selectedContract.depositAmount)}</p>
                  <p>Devuelto: {formatCurrency(selectedContract.depositReturnedAmount)}</p>
                  <p>
                    Pendiente: {formatCurrency(Math.max(0, selectedContract.depositAmount - selectedContract.depositReturnedAmount))}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2">
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
                    <SelectItem value="prorrogado">🔄 Prorrogado</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="rescindido">Rescindido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 border rounded-xl p-4 bg-slate-50">
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-blue-600" /> Adjuntar PDF del contrato
                </label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="bg-white"
                />
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openPreview(selectedContract.contractUrl)}
                    disabled={!selectedContract.contractUrl}
                  >
                    <Eye className="w-4 h-4" /> Ver PDF actual
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeletePdf}
                    disabled={!selectedContract.contractUrl || deletingPdf}
                  >
                    <Trash2 className="w-4 h-4" /> {deletingPdf ? "Borrando..." : "Borrar PDF"}
                  </Button>
                </div>
              </div>

              <div className="md:col-span-2">
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-6xl h-[90vh] p-4 bg-white">
          <DialogHeader>
            <DialogTitle>Vista previa del contrato</DialogTitle>
          </DialogHeader>
          <div className="w-full h-full border rounded-lg overflow-hidden bg-slate-100">
            {previewUrl ? (
              <iframe src={previewUrl} title="Vista previa" className="w-full h-[78vh] bg-white" />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                No hay documento.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}