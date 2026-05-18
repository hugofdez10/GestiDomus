"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { AddContractForm } from "@/components/ui/dashboard/add-contract-form"
import { GenerateMonthlyInvoicesButton } from "@/components/ui/dashboard/generate-monthly-invoices-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/utils/supabase/client"
import { deleteContract } from "@/lib/deleteContract"
import { getStorageDisplayUrl } from "@/lib/storage"
import { smoothListItemMotion } from "@/components/ui/dashboard/smooth-motion"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

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
  | "draft" | "sent" | "signed" | "active" | "expired" | "terminated" | "renewed"
  | "borrador" | "pendiente_firma" | "activo" | "vencido" | "rescindido" | "prorrogado"

type DepositDbStatus =
  | "pending" | "received" | "returned" | "partially_returned" | "withheld"
  | "pendiente" | "parcial" | "devuelta" | "retenida"

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

type ContractRelation = {
  name?: string | null
}

type TenantRelation = {
  full_name?: string | null
  email?: string | null
  phone?: string | null
}

type ContractQueryRow = {
  id: string | number
  tenant_id?: number | null
  contract_code?: string | null
  deposit_status?: DepositDbStatus | null
  deposit_amount?: number | string | null
  deposit_returned_amount?: number | string | null
  start_date?: string | null
  end_date?: string | null
  contract_status?: ContractDbStatus | null
  document_path?: string | null
  properties?: ContractRelation | ContractRelation[] | null
  tenants?: TenantRelation | TenantRelation[] | null
}

function getErrorMessage(error: unknown, fallback = "Sin detalle") {
  return error instanceof Error ? error.message : fallback
}

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
      return "draft"
    case "pendiente_firma":
      return "sent"
    case "activo":
      return "active"
    case "vencido":
      return "expired"
    case "rescindido":
      return "terminated"
    case "prorrogado":
      return "renewed"
    default:
      return "draft"
  }
}

function mapDepositStatusToDb(status: DepositStatus): DepositDbStatus {
  switch (status) {
    case "pendiente":
      return "pending"
    case "parcial":
      return "partially_returned"
    case "devuelta":
      return "returned"
    case "retenida":
      return "withheld"
    default:
      return "pending"
  }
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

function calcDurationMonths(start: string, end: string): number | null {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

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

  const diffDays = Math.ceil(
    (new Date(row.contractEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

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

const CONTRACT_DURATIONS = [
  { label: "6 meses", value: 6 },
  { label: "11 meses", value: 11 },
  { label: "12 meses (1 año)", value: 12 },
  { label: "24 meses (2 años)", value: 24 },
  { label: "36 meses (3 años)", value: 36 },
  { label: "60 meses (5 años)", value: 60 },
  { label: "Personalizado", value: 0 },
]

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function ContractTableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="px-8 py-6">
            <Skeleton className="h-4 w-44" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-32 rounded-lg" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-3 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-32 rounded-lg" />
            <Skeleton className="mt-2 h-3 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-24 rounded-lg" />
          </TableCell>
          <TableCell className="px-8">
            <div className="flex justify-end gap-2">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

function ContractMobileSkeletonCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-lg" />
            <Skeleton className="h-6 w-28 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </>
  )
}

export function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
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
  const deferredSearch = useDeferredValue(search)
  const shouldReduceMotion = useReducedMotion()

  async function loadContracts({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setLoading(true)
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
      if (!silent) setLoading(false)
      return
    }

    const mapped: ContractRow[] = ((data ?? []) as ContractQueryRow[]).map((c) => {
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
        depositStatus: normalizeDepositStatusFromDb(c.deposit_status ?? undefined),
        depositAmount: Number(c.deposit_amount ?? 0),
        depositReturnedAmount: Number(c.deposit_returned_amount ?? 0),
        contractStart: c.start_date ?? "",
        contractEnd: c.end_date ?? "",
        contractStatus: normalizeContractStatusFromDb(c.contract_status ?? undefined),
        contractUrl: c.document_path ?? "",
      }
    })

    setContracts(mapped)
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    loadContracts()
  }, [])

  const filteredContracts = useMemo(() => {
    return contracts
      .filter((item) => {
        const q = deferredSearch.trim().toLowerCase()

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
  }, [contracts, deferredSearch, contractStatusFilter, depositStatusFilter])

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

  async function openPreview(url?: string) {
    if (!url) {
      alert("Este contrato no tiene documento adjunto.")
      return
    }

    try {
      const displayUrl = await getStorageDisplayUrl(supabase, "vault", url)
      setPreviewUrl(displayUrl || "")
      setPreviewOpen(true)
    } catch {
      alert("No se pudo abrir el documento temporalmente.")
    }
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
    if (extension !== "pdf") throw new Error("Solo se permiten PDF.")

    const filePath = `contracts/contract-${contractId}-${Date.now()}.pdf`

    const { error } = await supabase.storage.from("vault").upload(filePath, file, {
      upsert: true,
      contentType: "application/pdf",
    })

    if (error) throw error

    return filePath
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
      setContracts((current) =>
        current.map((contract) =>
          contract.id === selectedContract.id ? { ...contract, contractUrl: "" } : contract
        )
      )
      void loadContracts({ silent: true })
    } catch (e) {
      alert("Error al borrar el PDF: " + getErrorMessage(e))
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
      setContracts((current) => current.filter((item) => item.id !== contract.id))
    } catch (e) {
      alert("Error al eliminar contrato: " + getErrorMessage(e))
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


      const updatePayload = {
        contract_code: selectedContract.contractName || null,
        deposit_status: mapDepositStatusToDb(finalDepositStatus),
        deposit_amount: Number(selectedContract.depositAmount || 0),
        deposit_returned_amount: Number(selectedContract.depositReturnedAmount || 0),
        start_date: selectedContract.contractStart || null,
        end_date: selectedContract.contractEnd || null,
        contract_status: mapContractStatusToDb(selectedContract.contractStatus),
        document_path: finalDocumentUrl,
      }

      const { error } = await supabase
        .from("contracts")
        .update(updatePayload)
        .eq("id", selectedContract.id)

      if (error) throw error
      const updatedContract: ContractRow = {
        ...selectedContract,
        depositStatus: finalDepositStatus,
        contractUrl: finalDocumentUrl || "",
      }
      setContracts((current) =>
        current.map((contract) => (contract.id === selectedContract.id ? updatedContract : contract))
      )
      setEditOpen(false)
      setSelectedContract(null)
      setPdfFile(null)
      void loadContracts({ silent: true })
    } catch (e) {
      alert("Error al guardar: " + getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-slate-100 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div className="mb-12 space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase flex items-center gap-4">
              <span className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100">
                <FileSignature className="w-8 h-8" />
              </span>
              Gestión de Contratos
            </h1>
            <p className="text-slate-500 font-semibold mt-4 tracking-wide max-w-2xl">
              Control exhaustivo de arrendamientos: supervisión de fianzas, vigencia legal y automatización de documentación PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm ring-1 ring-black/5">
            <AddContractForm onCreated={() => loadContracts({ silent: true })} triggerClassName="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold px-6 py-2 shadow-none" />
            <GenerateMonthlyInvoicesButton onDone={() => loadContracts({ silent: true })} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            {
              label: "Activos",
              value: activeCount,
              icon: <FileSignature className="w-4 h-4" />,
              accent: "bg-emerald-500",
              light: "bg-emerald-50",
              text: "text-emerald-600",
            },
            {
              label: "Pend. firma",
              value: pendingSignatureCount,
              icon: <Clock className="w-4 h-4" />,
              accent: "bg-amber-500",
              light: "bg-amber-50",
              text: "text-amber-600",
            },
            {
              label: "Prorrogados",
              value: prorrogadoCount,
              icon: <Clock className="w-4 h-4" />,
              accent: "bg-purple-500",
              light: "bg-purple-50",
              text: "text-purple-600",
            },
            {
              label: "Fianzas pend.",
              value: depositPendingCount,
              icon: <ShieldCheck className="w-4 h-4" />,
              accent: "bg-rose-500",
              light: "bg-rose-50",
              text: "text-rose-600",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="relative overflow-hidden bg-white border-none shadow-xl shadow-slate-200/50 rounded-2xl p-6 group transition-all hover:scale-[1.02]"
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${stat.accent}`} />
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">
                <span className={`p-1.5 ${stat.light} ${stat.text} rounded-lg`}>
                  {stat.icon}
                </span>
                {stat.label}
              </div>
              <p className={`text-3xl font-black text-slate-900 tabular-nums tracking-tight`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-lg shadow-slate-200/50 overflow-hidden">
        <div className="p-8 border-b border-slate-100">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between mb-8">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="w-2 h-6 bg-blue-600 rounded-full" />
              REGISTRO MAESTRO
            </h2>
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-blue-600 font-bold text-xs uppercase tracking-widest"
              onClick={() => {
                setSearch("")
                setContractStatusFilter("all")
                setDepositStatusFilter("all")
              }}
            >
              Limpiar filtros
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por inmueble, inquilino, email..."
                className="pl-12 bg-slate-50/50 border-none h-12 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="lg:col-span-3">
              <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
                <SelectTrigger className="bg-slate-50/50 border-none h-12 rounded-xl ring-1 ring-slate-200">
                  <SelectValue placeholder="Estado contrato" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
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
                <SelectTrigger className="bg-slate-50/50 border-none h-12 rounded-xl ring-1 ring-slate-200">
                  <SelectValue placeholder="Estado fianza" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
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
              <TableRow className="bg-slate-50/30 border-none">
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 px-8 py-5">Inmueble</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Inquilino</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Contrato</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Inicio</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Fin / Duración</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Fianza</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Estado</TableHead>
                <TableHead className="text-right px-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <AnimatePresence initial={false}>
                {loading ? (
                  <ContractTableSkeletonRows />
                ) : filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-20 text-center text-slate-400 font-semibold italic">
                      No se han encontrado registros maestros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map((contract, index) => {
                    const effectiveStatus = getAutoContractStatus(contract)
                    const duration = calcDurationMonths(contract.contractStart, contract.contractEnd)

                    return (
                      <motion.tr
                        key={contract.id}
                        {...smoothListItemMotion(index, shouldReduceMotion ?? false)}
                        className="hover:bg-blue-50/30 transition-colors duration-200 ease-out border-b border-slate-50"
                      >
                        <TableCell className="px-8 py-6">
                          <p className="font-black text-slate-900 tracking-tight">{contract.property}</p>
                        </TableCell>

                        <TableCell>
                          <p className="font-bold text-slate-700">{contract.tenant}</p>
                          <div className="flex gap-2 mt-1">
                            {contract.email && (
                              <a href={`mailto:${contract.email}`} className="text-[10px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-tighter">Email</a>
                            )}
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{contract.phone || "—"}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-slate-700 tabular-nums">
                              {contract.contractName || "DRAFT-00"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-sm font-semibold text-slate-600 tabular-nums">
                          {formatDate(contract.contractStart)}
                        </TableCell>

                        <TableCell>
                          <p className="text-sm font-semibold text-slate-600 tabular-nums">{formatDate(contract.contractEnd)}</p>
                          {duration !== null && (
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{duration} MESES</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className={`rounded-lg border-none font-black text-[10px] uppercase tracking-widest px-2.5 py-1 ${getDepositStatusClasses(contract.depositStatus)}`}>
                            {getDepositStatusLabel(contract.depositStatus)}
                          </Badge>
                          <p className="text-[10px] font-black text-slate-400 mt-1.5 tabular-nums">
                            {formatCurrency(contract.depositReturnedAmount)} / {formatCurrency(contract.depositAmount)}
                          </p>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className={`rounded-lg border-none font-black text-[10px] uppercase tracking-widest px-2.5 py-1 ${getContractStatusClasses(effectiveStatus)}`}>
                            {getContractStatusLabel(effectiveStatus)}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right px-8">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(contract)} className="hover:bg-blue-50 hover:text-blue-600 rounded-xl">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPreview(contract.contractUrl)}
                              disabled={!contract.contractUrl}
                              className="hover:bg-indigo-50 hover:text-indigo-600 rounded-xl"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteContract(contract)}
                              disabled={deletingContractId === contract.id}
                              className="hover:bg-red-50 hover:text-red-600 rounded-xl"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    )
                  })
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>

        <div className="lg:hidden p-4 space-y-4">
          {loading ? (
            <ContractMobileSkeletonCards />
          ) : filteredContracts.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-center text-slate-500 shadow-sm">
              No hay contratos con los filtros actuales.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredContracts.map((contract, index) => {
                const effectiveStatus = getAutoContractStatus(contract)
                const duration = calcDurationMonths(contract.contractStart, contract.contractEnd)

                return (
                  <motion.div
                    key={contract.id}
                    {...smoothListItemMotion(index, shouldReduceMotion ?? false)}
                    className="rounded-xl border bg-white p-4 shadow-sm space-y-3"
                  >
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
                  </motion.div>
                )
              })}
            </AnimatePresence>
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
                  onChange={(e) =>
                    updateSelectedField("depositReturnedAmount", Number(e.target.value || 0))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Estado de la fianza</label>
                <Select
                  value={selectedContract.depositStatus}
                  onValueChange={(value: DepositStatus) => updateSelectedField("depositStatus", value)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                    Pendiente: {formatCurrency(
                      Math.max(0, selectedContract.depositAmount - selectedContract.depositReturnedAmount)
                    )}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700 mb-1 block">Estado del contrato</label>
                <Select
                  value={selectedContract.contractStatus}
                  onValueChange={(value: ContractStatus) => updateSelectedField("contractStatus", value)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
