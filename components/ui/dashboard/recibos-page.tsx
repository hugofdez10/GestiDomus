"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getActiveContractForTenant,
  getContractDisplayStatus,
  getMostRecentContractForTenant,
  isContractInForce,
  type ContractDisplayStatus,
} from "@/lib/contracts"
import {
  Receipt,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  Users,
  Plus,
  Printer,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  Wifi,
  ExternalLink,
  Download,
} from "lucide-react"
import { exportTablePdf, formatDateEs, formatEuro } from "@/lib/pdf-export"
import { getStorageDisplayUrl, isExternalStorageUrl } from "@/lib/storage"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tenant = {
  id: number
  full_name: string
  email: string | null
  phone: string | null
}

type Contract = {
  id: string
  property_id: number
  tenant_id: number
  monthly_rent: number
  contract_status: string
  start_date: string
  end_date: string | null
  properties?: {
    name: string
    address: string | null
    payment_account_holder: string | null
    payment_account_iban: string | null
    sender_email: string | null
  } | null
  tenants?: Tenant
}

type Invoice = {
  id: string
  contract_id: string
  property_id: number
  tenant_id: number
  billing_year: number
  billing_month: number
  billing_period: string
  due_date: string
  amount: number
  gas: number
  luz: number
  agua: number
  internet: number
  gas_expense_id: number | null
  gas_receipt_url: string | null
  luz_expense_id: number | null
  luz_receipt_url: string | null
  agua_expense_id: number | null
  agua_receipt_url: string | null
  internet_expense_id: number | null
  internet_receipt_url: string | null
  property_address_snapshot: string | null
  payment_account_holder: string | null
  payment_account_iban: string | null
  email_status: "not_sent" | "sent" | "failed" | "manual" | null
  sent_to_email: string | null
  sent_from_email: string | null
  email_subject: string | null
  email_filename: string | null
  email_error: string | null
  combined_pdf_url: string | null
  status: "pending" | "paid"
  sent_at: string | null
  paid_at: string | null
  notes: string | null
  invoice_pdf_url: string | null
  created_at: string
}

type Expense = {
  id: number
  category: string
  amount: number
  date: string
  property_id: number | null
  receipt_url: string | null
}

type TenantWithContract = Tenant & {
  contract: Contract | null
  contractDisplayStatus: ContractDisplayStatus
  invoices: Invoice[]
  pendingTotal: number
}

type UtilityKey = "gas" | "luz" | "agua" | "internet"

type InvoiceAttachment = {
  key: UtilityKey
  label: string
  amount: number
  expenseId: number | null
  receiptUrl: string | null
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const ARRENDADOR = {
  nombre: "Francisco Javier Fernández Alonso",
  iban: "ES95 0049 6254 3424 9504 3155",
}

const AVAILABLE_FROM_EMAILS = (process.env.NEXT_PUBLIC_ALLOWED_FROM_EMAILS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function fmtFecha(s: string | null) {
  if (!s) return "—"
  const normalized = s.includes("T") ? s.split("T")[0] : s
  const [y, m, d] = normalized.split("-")
  return `${d}/${m}/${y}`
}

function totalInvoice(inv: Invoice) {
  return inv.amount + (inv.gas || 0) + (inv.luz || 0) + (inv.agua || 0) + (inv.internet || 0)
}

function mesAno(inv: Invoice) {
  return `${MESES[inv.billing_month - 1]} ${inv.billing_year}`
}

function isPdf(url: string | null) {
  if (!url) return false
  return url.toLowerCase().includes(".pdf") || url.toLowerCase().includes("pdf")
}

function uint8ArrayToArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

function sanitizeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || "recibo"
}

function ensurePdfFileName(value: string) {
  const cleaned = sanitizeFileName(value.replace(/\.pdf$/i, ""))
  return `${cleaned}.pdf`
}

function buildDefaultPdfFileName(inv: Invoice, tenantName: string) {
  const month = String(inv.billing_month).padStart(2, "0")
  return ensurePdfFileName(`recibo-${tenantName}-${inv.billing_year}-${month}`)
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = ""
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function getInvoiceAttachments(inv: Invoice): InvoiceAttachment[] {
  const attachments: InvoiceAttachment[] = [
    {
      key: "gas",
      label: "Gas",
      amount: inv.gas || 0,
      expenseId: inv.gas_expense_id,
      receiptUrl: inv.gas_receipt_url,
    },
    {
      key: "luz",
      label: "Luz",
      amount: inv.luz || 0,
      expenseId: inv.luz_expense_id,
      receiptUrl: inv.luz_receipt_url,
    },
    {
      key: "agua",
      label: "Agua",
      amount: inv.agua || 0,
      expenseId: inv.agua_expense_id,
      receiptUrl: inv.agua_receipt_url,
    },
    {
      key: "internet",
      label: "Internet",
      amount: inv.internet || 0,
      expenseId: inv.internet_expense_id,
      receiptUrl: inv.internet_receipt_url,
    },
  ]

  return attachments.filter((item) => item.amount > 0 || !!item.receiptUrl || !!item.expenseId)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function RecibosPage() {
  const [data, setData] = useState<TenantWithContract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedTenant, setSelectedTenant] = useState<TenantWithContract | null>(null)
  const [expandedTenants, setExpandedTenants] = useState<Set<number>>(new Set())

  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [showGenerarForm, setShowGenerarForm] = useState(false)

  const [formMes, setFormMes] = useState(new Date().getMonth() + 1)
  const [formAno, setFormAno] = useState(new Date().getFullYear())
  const [formAlquiler, setFormAlquiler] = useState("")
  const [formGas, setFormGas] = useState("")
  const [formLuz, setFormLuz] = useState("")
  const [formAgua, setFormAgua] = useState("")
  const [formInternet, setFormInternet] = useState("")
  const [formSaving, setFormSaving] = useState(false)

  const [expensesGas, setExpensesGas] = useState<Expense[]>([])
  const [expensesLuz, setExpensesLuz] = useState<Expense[]>([])
  const [expensesAgua, setExpensesAgua] = useState<Expense[]>([])
  const [expensesInternet, setExpensesInternet] = useState<Expense[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)

  const [selectedGasExpenseId, setSelectedGasExpenseId] = useState<number | null>(null)
  const [selectedLuzExpenseId, setSelectedLuzExpenseId] = useState<number | null>(null)
  const [selectedAguaExpenseId, setSelectedAguaExpenseId] = useState<number | null>(null)
  const [selectedInternetExpenseId, setSelectedInternetExpenseId] = useState<number | null>(null)

  const [invoicePdfFile, setInvoicePdfFile] = useState<File | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [documentAction, setDocumentAction] = useState<"print" | "email" | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [savingInvoiceMeta, setSavingInvoiceMeta] = useState(false)
  const [emailTo, setEmailTo] = useState("")
  const [emailFrom, setEmailFrom] = useState(AVAILABLE_FROM_EMAILS[0] || "")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailFileName, setEmailFileName] = useState("")
  const [paymentHolder, setPaymentHolder] = useState(ARRENDADOR.nombre)
  const [paymentIban, setPaymentIban] = useState(ARRENDADOR.iban)
  const [propertyAddress, setPropertyAddress] = useState("")
  const [signedVaultUrls, setSignedVaultUrls] = useState<Record<string, string>>({})

  const fetchAll = useCallback(async () => {
    setLoading(true)

    const [tenantsRes, contractsRes, invoicesRes] = await Promise.all([
      supabase.from("tenants").select("id, full_name, email, phone").order("full_name"),
      supabase
        .from("contracts")
        .select("id, property_id, tenant_id, monthly_rent, contract_status, start_date, end_date, properties(name, address, payment_account_holder, payment_account_iban, sender_email)")
        .order("start_date", { ascending: false }),
      supabase
        .from("invoices")
        .select(`
          id,
          contract_id,
          property_id,
          tenant_id,
          billing_year,
          billing_month,
          billing_period,
          due_date,
          amount,
          gas,
          luz,
          agua,
          internet,
          gas_expense_id,
          gas_receipt_url,
          luz_expense_id,
          luz_receipt_url,
          agua_expense_id,
          agua_receipt_url,
          internet_expense_id,
          internet_receipt_url,
          property_address_snapshot,
          payment_account_holder,
          payment_account_iban,
          email_status,
          sent_to_email,
          sent_from_email,
          email_subject,
          email_filename,
          email_error,
          combined_pdf_url,
          status,
          sent_at,
          paid_at,
          notes,
          invoice_pdf_url,
          created_at
        `)
        .order("billing_year", { ascending: false })
        .order("billing_month", { ascending: false }),
    ])

    const tenants: Tenant[] = tenantsRes.data || []
    const contracts = (contractsRes.data || []) as unknown as Contract[]
    const invoices: Invoice[] = invoicesRes.data || []

    const merged: TenantWithContract[] = tenants.map((t) => {
      const contract =
        getActiveContractForTenant(t.id, contracts) ||
        getMostRecentContractForTenant(t.id, contracts)
      const tenantInvoices = invoices.filter((i) => i.tenant_id === t.id)
      const pendingTotal = tenantInvoices
        .filter((i) => i.status === "pending")
        .reduce((s, i) => s + totalInvoice(i), 0)
      return { ...t, contract, contractDisplayStatus: getContractDisplayStatus(contract), invoices: tenantInvoices, pendingTotal }
    }).sort((a, b) => {
      const aRank = a.contractDisplayStatus === "vigente" ? 0 : a.contractDisplayStatus === "finalizado" ? 1 : 2
      const bRank = b.contractDisplayStatus === "vigente" ? 0 : b.contractDisplayStatus === "finalizado" ? 1 : 2
      return aRank - bRank || a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" })
    })

    setData(merged)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function fetchExpensesForProperty(propertyId: number) {
    setLoadingExpenses(true)
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, category, amount, date, property_id, receipt_url")
      .eq("property_id", propertyId)
      .in("category", ["Gas", "Electricidad", "Agua", "Internet"])
      .order("date", { ascending: false })

    const all: Expense[] = expenses || []
    setExpensesGas(all.filter((e) => e.category === "Gas"))
    setExpensesLuz(all.filter((e) => e.category === "Electricidad"))
    setExpensesAgua(all.filter((e) => e.category === "Agua"))
    setExpensesInternet(all.filter((e) => e.category === "Internet"))
    setLoadingExpenses(false)
  }

  function getExpenseByUtility(kind: UtilityKey, expenseId: number | null) {
    if (!expenseId) return null

    const source =
      kind === "gas"
        ? expensesGas
        : kind === "luz"
          ? expensesLuz
          : kind === "agua"
            ? expensesAgua
            : expensesInternet

    return source.find((exp) => exp.id === expenseId) || null
  }

  function setArchivedExpense(kind: UtilityKey, expenseIdRaw: string) {
    const expenseId = Number(expenseIdRaw)
    const expense = getExpenseByUtility(kind, expenseId)
    if (!expense) return

    if (kind === "gas") {
      setSelectedGasExpenseId(expense.id)
      setFormGas(String(expense.amount))
      return
    }

    if (kind === "luz") {
      setSelectedLuzExpenseId(expense.id)
      setFormLuz(String(expense.amount))
      return
    }

    if (kind === "agua") {
      setSelectedAguaExpenseId(expense.id)
      setFormAgua(String(expense.amount))
      return
    }

    setSelectedInternetExpenseId(expense.id)
    setFormInternet(String(expense.amount))
  }

  useEffect(() => {
    if (!viewInvoice) return

    const tenant = getInvoiceTenant(viewInvoice)
    const contract = tenant?.contract
    const property = contract?.properties

    setPropertyAddress(viewInvoice.property_address_snapshot || property?.address || property?.name || "")
    setPaymentHolder(viewInvoice.payment_account_holder || property?.payment_account_holder || ARRENDADOR.nombre)
    setPaymentIban(viewInvoice.payment_account_iban || property?.payment_account_iban || ARRENDADOR.iban)
    setEmailTo(viewInvoice.sent_to_email || tenant?.email || "")
    setEmailFrom(viewInvoice.sent_from_email || property?.sender_email || AVAILABLE_FROM_EMAILS[0] || "")
    setEmailSubject(viewInvoice.email_subject || `Recibo de alquiler – ${mesAno(viewInvoice)}`)
    setEmailFileName(viewInvoice.email_filename || buildDefaultPdfFileName(viewInvoice, tenant?.full_name || "inquilino"))
  }, [viewInvoice, data])

  useEffect(() => {
    if (!viewInvoice) return

    const values = [
      viewInvoice.invoice_pdf_url,
      viewInvoice.combined_pdf_url,
      ...getInvoiceAttachments(viewInvoice).map((item) => item.receiptUrl),
    ].filter((value): value is string => !!value)

    const missingValues = values.filter((value) => !signedVaultUrls[value])
    if (missingValues.length === 0) return

    let cancelled = false

    async function resolveUrls() {
      const entries = await Promise.all(
        missingValues.map(async (value) => [
          value,
          await getStorageDisplayUrl(supabase, "vault", value).catch(() => null),
        ] as const)
      )

      if (cancelled) return

      setSignedVaultUrls((current) => {
        const next = { ...current }
        entries.forEach(([value, url]) => {
          if (url) next[value] = url
        })
        return next
      })
    }

    void resolveUrls()

    return () => {
      cancelled = true
    }
  }, [viewInvoice, signedVaultUrls])

  function displayVaultUrl(value: string | null) {
    if (!value) return null
    return signedVaultUrls[value] || (isExternalStorageUrl(value) ? value : null)
  }

  const filtered = data.filter((t) =>
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.email || "").toLowerCase().includes(search.toLowerCase())
  )

  const hasActiveContract = (t: TenantWithContract) => isContractInForce(t.contract)

  function openGenerarRecibo(tenant: TenantWithContract) {
    setSelectedTenant(tenant)
    setFormMes(new Date().getMonth() + 1)
    setFormAno(new Date().getFullYear())
    setFormAlquiler(String(tenant.contract?.monthly_rent || ""))
    setFormGas("")
    setFormLuz("")
    setFormAgua("")
    setFormInternet("")
    setSelectedGasExpenseId(null)
    setSelectedLuzExpenseId(null)
    setSelectedAguaExpenseId(null)
    setSelectedInternetExpenseId(null)
    setShowGenerarForm(true)
    if (tenant.contract?.property_id) fetchExpensesForProperty(tenant.contract.property_id)
  }

  async function handleGenerarRecibo() {
    if (!selectedTenant?.contract) return

    const existe = selectedTenant.invoices.find(
      (i) => i.billing_year === formAno && i.billing_month === formMes
    )
    if (existe) {
      alert(`Ya existe un recibo para ${MESES[formMes - 1]} ${formAno}`)
      return
    }

    setFormSaving(true)
    const pad = (n: number) => String(n).padStart(2, "0")
    const billingPeriod = `${formAno}-${pad(formMes)}-01`
    const dueDate = `${formAno}-${pad(formMes)}-05`

    const gasExpense = getExpenseByUtility("gas", selectedGasExpenseId)
    const luzExpense = getExpenseByUtility("luz", selectedLuzExpenseId)
    const aguaExpense = getExpenseByUtility("agua", selectedAguaExpenseId)
    const internetExpense = getExpenseByUtility("internet", selectedInternetExpenseId)

    const payload = {
      contract_id: selectedTenant.contract.id,
      property_id: selectedTenant.contract.property_id,
      tenant_id: selectedTenant.id,
      billing_year: formAno,
      billing_month: formMes,
      billing_period: billingPeriod,
      due_date: dueDate,
      amount: parseFloat(formAlquiler) || 0,
      gas: parseFloat(formGas) || 0,
      luz: parseFloat(formLuz) || 0,
      agua: parseFloat(formAgua) || 0,
      internet: parseFloat(formInternet) || 0,
      gas_expense_id: gasExpense?.id || null,
      gas_receipt_url: gasExpense?.receipt_url || null,
      luz_expense_id: luzExpense?.id || null,
      luz_receipt_url: luzExpense?.receipt_url || null,
      agua_expense_id: aguaExpense?.id || null,
      agua_receipt_url: aguaExpense?.receipt_url || null,
      internet_expense_id: internetExpense?.id || null,
      internet_receipt_url: internetExpense?.receipt_url || null,
      property_address_snapshot: selectedTenant.contract.properties?.address || selectedTenant.contract.properties?.name || null,
      payment_account_holder: selectedTenant.contract.properties?.payment_account_holder || ARRENDADOR.nombre,
      payment_account_iban: selectedTenant.contract.properties?.payment_account_iban || ARRENDADOR.iban,
      email_status: "not_sent",
      sent_to_email: selectedTenant.email || null,
      sent_from_email: selectedTenant.contract.properties?.sender_email || AVAILABLE_FROM_EMAILS[0] || null,
      email_subject: `Recibo de alquiler – ${MESES[formMes - 1]} ${formAno}`,
      email_filename: buildDefaultPdfFileName(
        {
          id: "temp",
          contract_id: selectedTenant.contract.id,
          property_id: selectedTenant.contract.property_id,
          tenant_id: selectedTenant.id,
          billing_year: formAno,
          billing_month: formMes,
          billing_period: billingPeriod,
          due_date: dueDate,
          amount: parseFloat(formAlquiler) || 0,
          gas: parseFloat(formGas) || 0,
          luz: parseFloat(formLuz) || 0,
          agua: parseFloat(formAgua) || 0,
          internet: parseFloat(formInternet) || 0,
          gas_expense_id: gasExpense?.id || null,
          gas_receipt_url: gasExpense?.receipt_url || null,
          luz_expense_id: luzExpense?.id || null,
          luz_receipt_url: luzExpense?.receipt_url || null,
          agua_expense_id: aguaExpense?.id || null,
          agua_receipt_url: aguaExpense?.receipt_url || null,
          internet_expense_id: internetExpense?.id || null,
          internet_receipt_url: internetExpense?.receipt_url || null,
          property_address_snapshot: selectedTenant.contract.properties?.address || selectedTenant.contract.properties?.name || null,
          payment_account_holder: selectedTenant.contract.properties?.payment_account_holder || ARRENDADOR.nombre,
          payment_account_iban: selectedTenant.contract.properties?.payment_account_iban || ARRENDADOR.iban,
          email_status: "not_sent",
          sent_to_email: selectedTenant.email || null,
          sent_from_email: selectedTenant.contract.properties?.sender_email || AVAILABLE_FROM_EMAILS[0] || null,
          email_subject: null,
          email_filename: null,
          email_error: null,
          combined_pdf_url: null,
          status: "pending",
          sent_at: null,
          paid_at: null,
          notes: null,
          invoice_pdf_url: null,
          created_at: new Date().toISOString(),
        },
        selectedTenant.full_name
      ),
      email_error: null,
      combined_pdf_url: null,
      status: "pending",
      notes: `Recibo ${MESES[formMes - 1]} ${formAno}`,
    }

    const { error } = await supabase.from("invoices").insert(payload)
    if (error) {
      alert("Error al crear el recibo: " + error.message)
    } else {
      setShowGenerarForm(false)
      await fetchAll()
    }
    setFormSaving(false)
  }

  async function togglePaid(inv: Invoice) {
    const newStatus = inv.status === "paid" ? "pending" : "paid"
    const update: Partial<Invoice> = {
      status: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
    }
    const { error } = await supabase.from("invoices").update(update).eq("id", inv.id)
    if (!error) {
      setViewInvoice((prev) => (prev?.id === inv.id ? { ...prev, ...update } as Invoice : prev))
      fetchAll()
    }
  }

  async function markSent(inv: Invoice) {
    const sentAt = new Date().toISOString()
    const { error } = await supabase
      .from("invoices")
      .update({ sent_at: sentAt, email_status: "manual", email_error: null })
      .eq("id", inv.id)
    if (!error) {
      setViewInvoice((prev) => (prev?.id === inv.id ? { ...prev, sent_at: sentAt, email_status: "manual", email_error: null } : prev))
      fetchAll()
      alert(`✅ Recibo marcado manualmente como enviado a ${selectedTenant?.email || "el inquilino"}`)
    }
  }

  async function handleDeleteInvoice(inv: Invoice) {
    if (!confirm(`¿Eliminar el recibo de ${mesAno(inv)}?`)) return
    const { error } = await supabase.from("invoices").delete().eq("id", inv.id)
    if (!error) {
      setViewInvoice(null)
      fetchAll()
    } else {
      alert("Error al eliminar: " + error.message)
    }
  }

  function toggleExpand(id: number) {
    setExpandedTenants((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getInvoiceTenant(inv: Invoice): TenantWithContract | undefined {
    return data.find((t) => t.id === inv.tenant_id)
  }

  function buildInvoiceMetaPatch() {
    return {
      property_address_snapshot: propertyAddress.trim() || null,
      payment_account_holder: paymentHolder.trim() || null,
      payment_account_iban: paymentIban.trim() || null,
      sent_to_email: emailTo.trim() || null,
      sent_from_email: emailFrom.trim() || null,
      email_subject: emailSubject.trim() || null,
      email_filename: ensurePdfFileName(emailFileName || "recibo"),
    }
  }

  async function saveInvoiceMeta(inv: Invoice, silent = false) {
    setSavingInvoiceMeta(true)
    try {
      const patch = buildInvoiceMetaPatch()
      const { data: updated, error } = await supabase
        .from("invoices")
        .update(patch)
        .eq("id", inv.id)
        .select(`
          id,
          contract_id,
          property_id,
          tenant_id,
          billing_year,
          billing_month,
          billing_period,
          due_date,
          amount,
          gas,
          luz,
          agua,
          internet,
          gas_expense_id,
          gas_receipt_url,
          luz_expense_id,
          luz_receipt_url,
          agua_expense_id,
          agua_receipt_url,
          internet_expense_id,
          internet_receipt_url,
          property_address_snapshot,
          payment_account_holder,
          payment_account_iban,
          email_status,
          sent_to_email,
          sent_from_email,
          email_subject,
          email_filename,
          email_error,
          combined_pdf_url,
          status,
          sent_at,
          paid_at,
          notes,
          invoice_pdf_url,
          created_at
        `)
        .single()

      if (error) throw error

      const nextInvoice = updated as Invoice
      setViewInvoice((prev) => (prev?.id === inv.id ? nextInvoice : prev))
      await fetchAll()
      if (!silent) alert("✅ Datos del recibo guardados")
      return nextInvoice
    } catch (e: any) {
      if (!silent) alert("Error al guardar los datos del recibo: " + e.message)
      throw e
    } finally {
      setSavingInvoiceMeta(false)
    }
  }

  async function updateInvoiceDelivery(inv: Invoice, patch: Partial<Invoice>) {
    const { data: updated, error } = await supabase
      .from("invoices")
      .update(patch)
      .eq("id", inv.id)
      .select(`
        id,
        contract_id,
        property_id,
        tenant_id,
        billing_year,
        billing_month,
        billing_period,
        due_date,
        amount,
        gas,
        luz,
        agua,
        internet,
        gas_expense_id,
        gas_receipt_url,
        luz_expense_id,
        luz_receipt_url,
        agua_expense_id,
        agua_receipt_url,
        internet_expense_id,
        internet_receipt_url,
        property_address_snapshot,
        payment_account_holder,
        payment_account_iban,
        email_status,
        sent_to_email,
        sent_from_email,
        email_subject,
        email_filename,
        email_error,
        combined_pdf_url,
        status,
        sent_at,
        paid_at,
        notes,
        invoice_pdf_url,
        created_at
      `)
      .single()

    if (error) throw error

    const nextInvoice = updated as Invoice
    setViewInvoice((prev) => (prev?.id === inv.id ? nextInvoice : prev))
    await fetchAll()
    return nextInvoice
  }

  async function fetchAsArrayBuffer(url: string) {
    const displayUrl = await getStorageDisplayUrl(supabase, "vault", url)
    if (!displayUrl) throw new Error("No se pudo preparar el archivo.")

    const response = await fetch(displayUrl)
    if (!response.ok) throw new Error(`No se pudo descargar el archivo (${response.status})`)
    return await response.arrayBuffer()
  }

  async function appendImageAsPdfPage(pdfDoc: any, bytes: ArrayBuffer) {
    const blob = new Blob([bytes])
    const objectUrl = URL.createObjectURL(blob)

    try {
      const imageEl = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("No se pudo leer la imagen del justificante"))
        img.src = objectUrl
      })

      const canvas = document.createElement("canvas")
      canvas.width = imageEl.naturalWidth
      canvas.height = imageEl.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("No se pudo preparar el canvas para la imagen")
      ctx.drawImage(imageEl, 0, 0)

      const pngDataUrl = canvas.toDataURL("image/png")
      const pngBytes = await fetch(pngDataUrl).then((res) => res.arrayBuffer())
      const embeddedImage = await pdfDoc.embedPng(pngBytes)

      const page = pdfDoc.addPage([595.28, 841.89])
      const margin = 24
      const maxWidth = page.getWidth() - margin * 2
      const maxHeight = page.getHeight() - margin * 2
      const ratio = Math.min(maxWidth / embeddedImage.width, maxHeight / embeddedImage.height)
      const width = embeddedImage.width * ratio
      const height = embeddedImage.height * ratio
      const x = (page.getWidth() - width) / 2
      const y = (page.getHeight() - height) / 2

      page.drawImage(embeddedImage, { x, y, width, height })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  async function buildCombinedInvoicePdf(
    inv: Invoice,
    options?: { propertyAddress?: string; paymentHolder?: string; paymentIban?: string }
  ) {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const summaryPage = pdfDoc.addPage([595.28, 841.89])
    const width = summaryPage.getWidth()
    const height = summaryPage.getHeight()
    const margin = 42
    let y = height - margin

    const tenant = getInvoiceTenant(inv)
    const attachments = getInvoiceAttachments(inv)
    const attachmentDocs = attachments.filter((item) => !!item.receiptUrl)
    const total = totalInvoice(inv)
    const appendErrors: string[] = []
    const resolvedPropertyAddress = options?.propertyAddress || inv.property_address_snapshot || tenant?.contract?.properties?.address || tenant?.contract?.properties?.name || "—"
    const resolvedPaymentHolder = options?.paymentHolder || inv.payment_account_holder || tenant?.contract?.properties?.payment_account_holder || ARRENDADOR.nombre
    const resolvedPaymentIban = options?.paymentIban || inv.payment_account_iban || tenant?.contract?.properties?.payment_account_iban || ARRENDADOR.iban

    summaryPage.drawText("RECIBO DE ALQUILER", {
      x: margin,
      y,
      size: 20,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    })
    y -= 28

    summaryPage.drawText(`Período: ${mesAno(inv)}`, { x: margin, y, size: 12, font })
    y -= 18
    summaryPage.drawText(`Inquilino: ${tenant?.full_name || "—"}`, { x: margin, y, size: 12, font })
    y -= 18
    summaryPage.drawText(`Dirección inmueble: ${resolvedPropertyAddress}`, { x: margin, y, size: 12, font })
    y -= 18
    summaryPage.drawText(`Fecha emisión: ${fmtFecha(inv.billing_period)}`, { x: margin, y, size: 12, font })
    y -= 18
    summaryPage.drawText(`Estado: ${inv.status === "paid" ? "Pagado" : "Pendiente"}`, { x: margin, y, size: 12, font })
    y -= 28

    summaryPage.drawText("Desglose", {
      x: margin,
      y,
      size: 13,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    })
    y -= 20

    const rows = [
      ["Alquiler", fmt(inv.amount)],
      inv.gas ? ["Gas", fmt(inv.gas)] : null,
      inv.luz ? ["Luz", fmt(inv.luz)] : null,
      inv.agua ? ["Agua", fmt(inv.agua)] : null,
      inv.internet ? ["Internet", fmt(inv.internet)] : null,
      ["TOTAL", fmt(total)],
    ].filter(Boolean) as [string, string][]

    rows.forEach(([label, value], index) => {
      const isTotal = index === rows.length - 1
      summaryPage.drawRectangle({
        x: margin,
        y: y - 8,
        width: width - margin * 2,
        height: 22,
        color: isTotal ? rgb(0.94, 0.97, 1) : rgb(1, 1, 1),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 1,
      })
      summaryPage.drawText(label, { x: margin + 10, y, size: 11, font: isTotal ? fontBold : font })
      summaryPage.drawText(value, { x: width - margin - 110, y, size: 11, font: isTotal ? fontBold : font })
      y -= 26
    })

    y -= 8
    summaryPage.drawText("Cuenta de domiciliación", {
      x: margin,
      y,
      size: 13,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    })
    y -= 18
    summaryPage.drawText(`${resolvedPaymentHolder}`, { x: margin, y, size: 11, font })
    y -= 16
    summaryPage.drawText(`${resolvedPaymentIban}`, { x: margin, y, size: 11, font })
    y -= 28

    summaryPage.drawText("Justificantes anexos en las siguientes páginas", {
      x: margin,
      y,
      size: 13,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    })
    y -= 18

    if (attachmentDocs.length === 0) {
      summaryPage.drawText("Este recibo no tiene facturas de suministros archivadas asociadas.", {
        x: margin,
        y,
        size: 11,
        font,
      })
    } else {
      attachmentDocs.forEach((attachment) => {
        summaryPage.drawText(`• ${attachment.label}: ${fmt(attachment.amount)}`, {
          x: margin,
          y,
          size: 11,
          font,
        })
        y -= 16
      })
    }

    for (const attachment of attachmentDocs) {
      try {
        const bytes = await fetchAsArrayBuffer(attachment.receiptUrl!)
        if (isPdf(attachment.receiptUrl)) {
          const sourcePdf = await PDFDocument.load(bytes)
          const pages = await pdfDoc.copyPages(sourcePdf, sourcePdf.getPageIndices())
          pages.forEach((page) => pdfDoc.addPage(page))
        } else {
          await appendImageAsPdfPage(pdfDoc, bytes)
        }
      } catch (error: any) {
        appendErrors.push(`${attachment.label}: ${error?.message || "No se pudo anexar"}`)
      }
    }

    if (appendErrors.length > 0) {
      summaryPage.drawText("Incidencias al anexar justificantes:", {
        x: margin,
        y: 86,
        size: 10,
        font: fontBold,
        color: rgb(0.7, 0.2, 0.2),
      })
      let errorY = 72
      appendErrors.slice(0, 5).forEach((msg) => {
        summaryPage.drawText(`- ${msg}`, {
          x: margin,
          y: errorY,
          size: 9,
          font,
          color: rgb(0.7, 0.2, 0.2),
        })
        errorY -= 12
      })
    }

    const pdfBytes = await pdfDoc.save()
    return { pdfBytes, attachmentDocs, appendErrors }
  }

  async function uploadCombinedInvoicePdf(inv: Invoice, pdfBytes: Uint8Array, preferredFileName?: string) {
    const safeName = ensurePdfFileName(preferredFileName || `recibo-compuesto-${inv.id}`)
    const filePath = `recibos/compuestos/${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from("vault")
      .upload(filePath, new Blob([uint8ArrayToArrayBuffer(pdfBytes)], { type: "application/pdf" }), { upsert: true, contentType: "application/pdf" })
    if (uploadError) throw uploadError

    return filePath
  }

  async function handlePrint(inv: Invoice) {
    const previewWindow = window.open("", "_blank")

    try {
      setDocumentAction("print")
      const persistedInvoice = await saveInvoiceMeta(inv, true)
      const { pdfBytes, appendErrors } = await buildCombinedInvoicePdf(persistedInvoice, {
        propertyAddress,
        paymentHolder,
        paymentIban,
      })
      const blob = new Blob([uint8ArrayToArrayBuffer(pdfBytes)], { type: "application/pdf" })
      const blobUrl = URL.createObjectURL(blob)

      if (previewWindow) {
        previewWindow.document.write(`
          <html>
            <head>
              <title>Recibo ${mesAno(inv)}</title>
              <style>
                html, body { margin: 0; height: 100%; }
                iframe { border: 0; width: 100%; height: 100%; }
              </style>
            </head>
            <body>
              <iframe src="${blobUrl}"></iframe>
            </body>
          </html>
        `)
        previewWindow.document.close()
      } else {
        window.open(blobUrl, "_blank")
      }

      if (appendErrors.length > 0) {
        alert(`Se abrió el PDF combinado, pero hubo justificantes que no se pudieron anexar:

${appendErrors.join("\n")}`)
      }
    } catch (e: any) {
      if (previewWindow) previewWindow.close()
      alert("Error al preparar el PDF para imprimir: " + e.message)
    } finally {
      setDocumentAction(null)
    }
  }

  async function handleSendEmail(inv: Invoice) {
    const tenant = getInvoiceTenant(inv)
    const recipient = emailTo.trim()
    const fromEmail = emailFrom.trim()
    const subject = emailSubject.trim() || `Recibo de alquiler – ${mesAno(inv)}`
    const filename = ensurePdfFileName(emailFileName || buildDefaultPdfFileName(inv, tenant?.full_name || "inquilino"))

    if (!recipient) {
      alert("El inquilino no tiene email configurado")
      return
    }

    if (!fromEmail) {
      alert("Configura el email remitente antes de enviar")
      return
    }

    try {
      setSendingEmail(true)
      setDocumentAction("email")

      const persistedInvoice = await saveInvoiceMeta(inv, true)
      const { pdfBytes, appendErrors } = await buildCombinedInvoicePdf(persistedInvoice, {
        propertyAddress,
        paymentHolder,
        paymentIban,
      })

      const combinedPdfUrl = await uploadCombinedInvoicePdf(persistedInvoice, pdfBytes, filename)
      const total = totalInvoice(persistedInvoice)
      const pdfBase64 = uint8ArrayToBase64(pdfBytes)
      const effectiveAddress = propertyAddress || persistedInvoice.property_address_snapshot || "—"
      const effectiveHolder = paymentHolder || persistedInvoice.payment_account_holder || ARRENDADOR.nombre
      const effectiveIban = paymentIban || persistedInvoice.payment_account_iban || ARRENDADOR.iban

      const text = [
        `Estimado/a ${tenant?.full_name || ""},`,
        "",
        `Adjuntamos el recibo de alquiler correspondiente a ${mesAno(persistedInvoice)}.`,
        "",
        `Dirección inmueble: ${effectiveAddress}`,
        `Alquiler: ${fmt(persistedInvoice.amount)}`,
        persistedInvoice.gas ? `Gas: ${fmt(persistedInvoice.gas)}` : "",
        persistedInvoice.luz ? `Luz: ${fmt(persistedInvoice.luz)}` : "",
        persistedInvoice.agua ? `Agua: ${fmt(persistedInvoice.agua)}` : "",
        persistedInvoice.internet ? `Internet: ${fmt(persistedInvoice.internet)}` : "",
        `TOTAL: ${fmt(total)}`,
        "",
        `Cuenta de domiciliación: ${effectiveHolder}`,
        effectiveIban,
        combinedPdfUrl ? "Copia archivada del documento: disponible en GestiDomus." : "",
        appendErrors.length > 0 ? `Avisos al anexar justificantes: ${appendErrors.join(" | ")}` : "",
        "",
        "Atentamente,",
        effectiveHolder,
      ].filter(Boolean).join("\n")

      const html = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <p>Estimado/a ${escapeHtml(tenant?.full_name || "")},</p>
          <p>Adjuntamos el recibo de alquiler correspondiente a <strong>${escapeHtml(mesAno(persistedInvoice))}</strong>.</p>
          <p>
            <strong>Dirección inmueble:</strong> ${escapeHtml(effectiveAddress)}<br />
            <strong>Alquiler:</strong> ${escapeHtml(fmt(persistedInvoice.amount))}<br />
            ${persistedInvoice.gas ? `<strong>Gas:</strong> ${escapeHtml(fmt(persistedInvoice.gas))}<br />` : ""}
            ${persistedInvoice.luz ? `<strong>Luz:</strong> ${escapeHtml(fmt(persistedInvoice.luz))}<br />` : ""}
            ${persistedInvoice.agua ? `<strong>Agua:</strong> ${escapeHtml(fmt(persistedInvoice.agua))}<br />` : ""}
            ${persistedInvoice.internet ? `<strong>Internet:</strong> ${escapeHtml(fmt(persistedInvoice.internet))}<br />` : ""}
            <strong>TOTAL:</strong> ${escapeHtml(fmt(total))}
          </p>
          <p>
            <strong>Cuenta de domiciliación:</strong><br />
            ${escapeHtml(effectiveHolder)}<br />
            ${escapeHtml(effectiveIban)}
          </p>
          ${combinedPdfUrl ? "<p><strong>Copia archivada del documento:</strong> disponible en GestiDomus.</p>" : ""}
          ${appendErrors.length > 0 ? `<p style="color:#b91c1c;"><strong>Avisos al anexar justificantes:</strong> ${escapeHtml(appendErrors.join(" | "))}</p>` : ""}
          <p>Atentamente,<br />${escapeHtml(effectiveHolder)}</p>
        </div>
      `

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Debes iniciar sesion para enviar recibos.")
      }

      const response = await fetch("/api/send-invoice-email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipient,
          from: fromEmail,
          subject,
          text,
          html,
          filename,
          pdfBase64,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        const message = result?.error || "No se pudo enviar el email"
        await updateInvoiceDelivery(persistedInvoice, {
          email_status: "failed",
          email_error: message,
          sent_to_email: recipient,
          sent_from_email: fromEmail,
          email_subject: subject,
          email_filename: filename,
          combined_pdf_url: combinedPdfUrl,
        })
        throw new Error(message)
      }

      await updateInvoiceDelivery(persistedInvoice, {
        sent_at: new Date().toISOString(),
        email_status: "sent",
        email_error: null,
        sent_to_email: recipient,
        sent_from_email: fromEmail,
        email_subject: subject,
        email_filename: filename,
        combined_pdf_url: combinedPdfUrl,
      })

      if (appendErrors.length > 0) {
        alert(`✅ Email enviado.

Hubo justificantes que no se pudieron anexar:
${appendErrors.join("\n")}`)
      } else {
        alert("✅ Email enviado correctamente")
      }
    } catch (e: any) {
      alert("Error al enviar el recibo por email: " + e.message)
    } finally {
      setSendingEmail(false)
      setDocumentAction(null)
    }
  }

  async function uploadInvoicePdf(inv: Invoice, file: File) {
    setUploadingPdf(true)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (ext !== "pdf") throw new Error("Solo se admiten PDF")

      const filePath = `recibos/recibo-${inv.id}-${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage
        .from("vault")
        .upload(filePath, file, { upsert: true, contentType: "application/pdf" })
      if (uploadError) throw uploadError

      const url = filePath

      const { error: updateError } = await supabase
        .from("invoices")
        .update({ invoice_pdf_url: url })
        .eq("id", inv.id)
      if (updateError) throw updateError

      setViewInvoice((prev) => prev?.id === inv.id ? { ...prev, invoice_pdf_url: url } : prev)
      setInvoicePdfFile(null)
      await fetchAll()
      alert("✅ PDF adjuntado correctamente al recibo")
    } catch (e: any) {
      alert("Error al subir PDF: " + e.message)
    } finally {
      setUploadingPdf(false)
    }
  }

  const totalPendiente = data.reduce((s, t) => s + t.pendingTotal, 0)
  const totalRecibos = data.reduce((s, t) => s + t.invoices.length, 0)
  const totalPendienteCount = data.reduce((s, t) => s + t.invoices.filter((i) => i.status === "pending").length, 0)

  function exportInvoicesPdf() {
    const rows = filtered.flatMap((tenant) =>
      tenant.invoices.map((invoice) => ({
        tenant: tenant.full_name,
        property: tenant.contract?.properties?.name || tenant.contract?.properties?.address || "",
        period: mesAno(invoice),
        dueDate: invoice.due_date,
        rent: invoice.amount,
        utilities: (invoice.gas || 0) + (invoice.luz || 0) + (invoice.agua || 0) + (invoice.internet || 0),
        total: totalInvoice(invoice),
        status: invoice.status === "paid" ? "Pagado" : "Pendiente",
        sentAt: invoice.sent_at,
        documents: [
          getInvoiceAttachments(invoice).some((item) => !!item.receiptUrl) ? "Justificantes" : "",
          invoice.invoice_pdf_url ? "PDF recibo" : "",
          invoice.combined_pdf_url ? "PDF combinado" : "",
        ].filter(Boolean).join(" + ") || "Sin adjuntos",
      }))
    )

    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0)
    const pending = rows
      .filter((row) => row.status === "Pendiente")
      .reduce((sum, row) => sum + Number(row.total || 0), 0)

    exportTablePdf({
      title: "Recibos de alquiler",
      subtitle: search ? `Filtro de busqueda: ${search}` : "Todos los recibos visibles",
      fileName: `Recibos_Alquiler_${new Date().getFullYear()}.pdf`,
      rows,
      summary: [
        `Recibos exportados: ${rows.length}`,
        `Total: ${formatEuro(total)}`,
        `Pendiente: ${formatEuro(pending)}`,
      ],
      columns: [
        { header: "Inquilino", value: "tenant" },
        { header: "Inmueble", value: "property" },
        { header: "Periodo", value: "period" },
        { header: "Vence", value: (row) => formatDateEs(row.dueDate) },
        { header: "Alquiler", value: (row) => formatEuro(row.rent) },
        { header: "Suministros", value: (row) => formatEuro(row.utilities) },
        { header: "Total", value: (row) => formatEuro(row.total) },
        { header: "Estado", value: "status" },
        { header: "Adjuntos", value: "documents" },
      ],
    })
  }

  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <Receipt className="w-7 h-7 text-blue-600" />
            Recibos de Alquiler
          </h1>
          <p className="text-slate-500 mt-2">Genera, consulta y envía los recibos mensuales de cada inquilino.</p>
        </div>

        <Button
          variant="outline"
          onClick={exportInvoicesPdf}
          className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 gap-2"
        >
          <Download className="w-4 h-4" /> Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total recibos</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{totalRecibos}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendientes de pago</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{totalPendienteCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deuda total pendiente</p>
          <p className="text-2xl font-black text-red-600 mt-1">{fmt(totalPendiente)}</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Buscar inquilino o email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400">Cargando datos...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((tenant) => {
            const expanded = expandedTenants.has(tenant.id)
            const isActive = hasActiveContract(tenant)
            const property = tenant.contract?.properties

            return (
              <div
                key={tenant.id}
                className={`rounded-xl border shadow-sm overflow-hidden ${
                  tenant.contractDisplayStatus === "vigente"
                    ? "bg-emerald-50/40 border-emerald-100"
                    : tenant.contractDisplayStatus === "finalizado"
                      ? "bg-slate-50 border-slate-200"
                      : "bg-rose-50/30 border-rose-100"
                }`}
              >
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer hover:bg-white/60 transition-colors"
                  onClick={() => toggleExpand(tenant.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                    {tenant.full_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800">{tenant.full_name}</p>
                      {tenant.contractDisplayStatus === "vigente" ? (
                        <Badge className="bg-green-100 text-green-800 text-[10px]">vigente</Badge>
                      ) : tenant.contractDisplayStatus === "finalizado" ? (
                        <Badge className="bg-slate-100 text-slate-600 text-[10px]">finalizado</Badge>
                      ) : tenant.contract ? (
                        <Badge className="bg-slate-100 text-slate-600 text-[10px]">{tenant.contract.contract_status}</Badge>
                      ) : (
                        <Badge className="bg-rose-50 text-rose-600 border border-rose-100 text-[10px]">sin contrato vigente</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {property?.name || property?.address || "Sin propiedad asignada"}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 ml-0 sm:ml-auto">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Recibos</p>
                      <p className="font-bold text-slate-700">{tenant.invoices.length}</p>
                    </div>
                    {tenant.pendingTotal > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Pendiente</p>
                        <p className="font-bold text-red-600">{fmt(tenant.pendingTotal)}</p>
                      </div>
                    )}
                    {isActive && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-1 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          openGenerarRecibo(tenant)
                          if (!expanded) toggleExpand(tenant.id)
                        }}
                      >
                        <Plus className="w-3 h-3" /> Recibo
                      </Button>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-100">
                    {tenant.invoices.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No hay recibos todavía</p>
                        {isActive && (
                          <button className="mt-2 text-blue-600 text-xs underline" onClick={() => openGenerarRecibo(tenant)}>
                            Generar primer recibo
                          </button>
                        )}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Período</TableHead>
                            <TableHead className="hidden sm:table-cell">Alquiler</TableHead>
                            <TableHead className="hidden md:table-cell">Suministros</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenant.invoices.map((inv) => {
                            const attachmentCount = getInvoiceAttachments(inv).filter((item) => !!item.receiptUrl).length
                            const hasAttachedInvoice = attachmentCount > 0 || !!inv.invoice_pdf_url || !!inv.combined_pdf_url

                            return (
                              <TableRow
                                key={inv.id}
                                className={hasAttachedInvoice ? "bg-blue-50/60 hover:bg-blue-100/70 border-l-4 border-l-blue-500" : "hover:bg-slate-50"}
                              >
                                <TableCell>
                                  <p className="font-semibold text-slate-700">{mesAno(inv)}</p>
                                  <p className="text-xs text-slate-400">Vence: {fmtFecha(inv.due_date)}</p>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-slate-600">{fmt(inv.amount)}</TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-slate-500">
                                  {(inv.gas || inv.luz || inv.agua || inv.internet) ? (
                                    <span>
                                      {inv.gas ? `Gas ${fmt(inv.gas)} · ` : ""}
                                      {inv.luz ? `Luz ${fmt(inv.luz)} · ` : ""}
                                      {inv.agua ? `Agua ${fmt(inv.agua)}` : ""}
                                      {inv.internet ? ` · Internet ${fmt(inv.internet)}` : ""}
                                    </span>
                                  ) : <span className="text-slate-300">—</span>}
                                </TableCell>
                                <TableCell className="font-bold text-slate-800">{fmt(totalInvoice(inv))}</TableCell>
                                <TableCell>
                                  {inv.status === "paid" ? (
                                    <Badge className="bg-green-100 text-green-800 text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" /> Pagado</Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1"><Clock className="w-3 h-3" /> Pendiente</Badge>
                                  )}
                                  {inv.sent_at && <p className="text-[10px] text-slate-400 mt-0.5">Enviado {fmtFecha(inv.sent_at)}</p>}
                                  {attachmentCount > 0 && <p className="text-[10px] text-blue-600 mt-0.5">📎 {attachmentCount} justificante(s)</p>}
                                  {inv.invoice_pdf_url && <p className="text-[10px] text-indigo-500 mt-0.5">📎 PDF adjunto</p>}
                                  {hasAttachedInvoice && <p className="text-[10px] font-bold text-blue-700 mt-0.5">Documentación lista</p>}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ver recibo"
                                    onClick={() => { setSelectedTenant(tenant); setViewInvoice(inv) }}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No se encontraron inquilinos</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!viewInvoice} onOpenChange={(o) => { if (!o) { setViewInvoice(null); setInvoicePdfFile(null) } }}>
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[700px] bg-white max-h-[95vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Recibo · {viewInvoice ? mesAno(viewInvoice) : ""}</DialogTitle>
          </DialogHeader>

          {viewInvoice && (() => {
            const tenant = getInvoiceTenant(viewInvoice)
            const contract = tenant?.contract
            const prop = contract?.properties
            const propertyAddr = viewInvoice.property_address_snapshot || prop?.address || prop?.name || "—"
            const total = totalInvoice(viewInvoice)
            const attachments = getInvoiceAttachments(viewInvoice)
            const invoicePdfDisplayUrl = displayVaultUrl(viewInvoice.invoice_pdf_url)

            const suministros: [string, number][] = [
              ["Gas:", viewInvoice.gas || 0],
              ["Luz:", viewInvoice.luz || 0],
              ["Agua:", viewInvoice.agua || 0],
              ["Internet:", viewInvoice.internet || 0],
            ].filter(([, val]) => (val as number) > 0) as [string, number][]

            return (
              <div>
                <div id="recibo-print" className="font-mono text-sm border border-slate-200 rounded-lg p-5 bg-white">
                  <h2 className="text-lg font-black border-b-2 border-slate-800 pb-3 mb-4 tracking-tight">
                    RECIBO DE ALQUILER — {MESES[viewInvoice.billing_month - 1].toUpperCase()} {viewInvoice.billing_year}
                  </h2>

                  <table className="w-full text-sm mb-4 border-collapse">
                    <tbody>
                      {[
                        ["Arrendador:", ARRENDADOR.nombre],
                        ["Arrendatario:", tenant?.full_name || "—"],
                        ["Dirección inmueble:", propertyAddr],
                        ["Alquiler:", fmt(viewInvoice.amount)],
                        ...suministros.map(([label, val]) => [label, fmt(val as number)]),
                      ].map(([label, value]) => (
                        <tr key={String(label)} className="border border-slate-200">
                          <td className="p-2 text-slate-500 w-40">{label}</td>
                          <td className="p-2 text-slate-800">{value}</td>
                        </tr>
                      ))}
                      <tr className="border border-slate-200 bg-slate-50">
                        <td className="p-2 font-black text-slate-800">TOTAL:</td>
                        <td className="p-2 font-black text-slate-800 text-base">{fmt(total)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border-t border-b border-slate-200 py-3 mb-4 flex gap-8">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Titular</p>
                      <p className="font-semibold">{viewInvoice.payment_account_holder || paymentHolder || ARRENDADOR.nombre}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">IBAN</p>
                      <p className="font-semibold">{viewInvoice.payment_account_iban || paymentIban || ARRENDADOR.iban}</p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-0.5 mb-4">
                    <p>Fecha emisión: {fmtFecha(viewInvoice.billing_period)}</p>
                    <p>Sin repercusión de IVA (arrendamiento de vivienda).</p>
                    {viewInvoice.sent_at && <p>Enviado: {new Date(viewInvoice.sent_at).toLocaleDateString("es-ES")}</p>}
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Justificación de suministros adjunta al recibo</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Aquí se guardan las facturas archivadas que se seleccionaron al crear este recibo.
                        </p>
                      </div>
                      <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                        {attachments.filter((item) => item.receiptUrl).length} adjunto(s)
                      </Badge>
                    </div>

                    {attachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-400">
                        Este recibo no tiene justificantes de suministros asociados.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {attachments.map((attachment) => {
                          const attachmentDisplayUrl = displayVaultUrl(attachment.receiptUrl)

                          return (
                          <div key={attachment.key} className="rounded-lg border border-slate-200 overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                              <div>
                                <p className="font-bold text-slate-800">{attachment.label}</p>
                                <p className="text-xs text-slate-500">
                                  Importe repercutido: {fmt(attachment.amount)}
                                  {attachment.expenseId ? ` · gasto #${attachment.expenseId}` : ""}
                                </p>
                              </div>
                              {attachmentDisplayUrl ? (
                                <a
                                  href={attachmentDisplayUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> Abrir justificante
                                </a>
                              ) : (
                                <span className="text-xs text-amber-600 font-medium">Sin archivo adjunto en el gasto original</span>
                              )}
                            </div>

                            {attachmentDisplayUrl ? (
                              <div className="bg-white p-3">
                                {isPdf(attachment.receiptUrl) ? (
                                  <iframe
                                    src={attachmentDisplayUrl}
                                    title={`Justificante ${attachment.label}`}
                                    className="w-full rounded-md border border-slate-200"
                                    style={{ height: "420px" }}
                                  />
                                ) : (
                                  <img
                                    src={attachmentDisplayUrl}
                                    alt={`Justificante ${attachment.label}`}
                                    className="w-full max-h-[520px] object-contain rounded-md border border-slate-200 bg-slate-50"
                                  />
                                )}
                              </div>
                            ) : null}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="md:col-span-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Configuración de envío y domiciliación
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Dirección inmueble</label>
                    <Input value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} placeholder="Calle / dirección para el resumen" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Email destinatario</label>
                    <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="inquilino@email.com" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Titular cuenta</label>
                    <Input value={paymentHolder} onChange={(e) => setPaymentHolder(e.target.value)} placeholder="Titular de la cuenta" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">IBAN</label>
                    <Input value={paymentIban} onChange={(e) => setPaymentIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Email remitente</label>
                    {AVAILABLE_FROM_EMAILS.length > 0 ? (
                      <Select value={emailFrom} onValueChange={setEmailFrom}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Selecciona remitente" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {AVAILABLE_FROM_EMAILS.map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="facturacion@tudominio.com" />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Asunto email</label>
                    <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Recibo de alquiler" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Nombre del archivo adjunto</label>
                    <Input value={emailFileName} onChange={(e) => setEmailFileName(e.target.value)} placeholder="recibo-alquiler-marzo-2026.pdf" />
                  </div>

                  <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => saveInvoiceMeta(viewInvoice)} disabled={savingInvoiceMeta}>
                      {savingInvoiceMeta ? "Guardando..." : "Guardar datos del recibo"}
                    </Button>
                    {viewInvoice.email_status === "sent" && viewInvoice.sent_at && (
                      <span className="text-xs text-emerald-600 font-medium">
                        ✅ Email enviado el {fmtFecha(viewInvoice.sent_at)}{viewInvoice.sent_from_email ? ` desde ${viewInvoice.sent_from_email}` : ""}
                      </span>
                    )}
                    {viewInvoice.email_status === "failed" && viewInvoice.email_error && (
                      <span className="text-xs text-red-600 font-medium">
                        ⚠ Último error: {viewInvoice.email_error}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    📎 PDF / documento adicional del recibo
                  </p>
                  {viewInvoice.invoice_pdf_url && invoicePdfDisplayUrl ? (
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <a
                        href={invoicePdfDisplayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver PDF
                      </a>
                      <a
                        href={invoicePdfDisplayUrl}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-indigo-300 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition-colors"
                      >
                        ⬇ Descargar
                      </a>
                      <span className="text-xs text-green-600 font-medium">✅ PDF adjunto</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mb-2 italic">Sin PDF adjunto adicional</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setInvoicePdfFile(e.target.files?.[0] || null)}
                      className="text-xs file:bg-indigo-50 file:text-indigo-700 file:border-0 file:rounded file:px-2 file:py-1 cursor-pointer"
                    />
                    {invoicePdfFile && (
                      <Button
                        size="sm"
                        disabled={uploadingPdf}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                        onClick={() => uploadInvoicePdf(viewInvoice, invoicePdfFile)}
                      >
                        {uploadingPdf ? "Subiendo..." : "Adjuntar"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handlePrint(viewInvoice)} disabled={documentAction !== null}>
                      <Printer className="w-4 h-4" /> {documentAction === "print" ? "Preparando PDF..." : "Imprimir"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteInvoice(viewInvoice)}>
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </Button>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => handleSendEmail(viewInvoice)}
                      title={emailTo ? `Enviar a ${emailTo}` : "Configura el email del inquilino"}
                      disabled={sendingEmail || documentAction !== null || !emailTo || !emailFrom}
                    >
                      <Send className="w-4 h-4" />
                      {sendingEmail || documentAction === "email" ? "Enviando..." : "Enviar por email"}
                    </Button>

                    <Button
                      size="sm"
                      variant={viewInvoice.status === "paid" ? "outline" : "default"}
                      className={viewInvoice.status === "paid" ? "gap-1 border-green-300 text-green-700" : "gap-1 bg-green-600 hover:bg-green-700 text-white"}
                      onClick={() => togglePaid(viewInvoice)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {viewInvoice.status === "paid" ? "Marcar pendiente" : "Marcar pagado"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => markSent(viewInvoice)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Marcar envío manual
                    </Button>
                  </div>
                </div>

                {emailTo ? (
                  <p className="text-[10px] text-slate-400 mt-2 text-right">
                    📧 El envío es real desde servidor. El remitente debe estar verificado en tu proveedor de correo.
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-500 mt-2 text-right">
                    ⚠️ Este inquilino no tiene email registrado. Ve a su ficha para añadirlo.
                  </p>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerarForm} onOpenChange={setShowGenerarForm}>
        <DialogContent className="w-[95vw] max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo recibo — {selectedTenant?.full_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              Inmueble: <strong>{selectedTenant?.contract?.properties?.name || selectedTenant?.contract?.properties?.address || "—"}</strong>
              <br />
              Alquiler base contractual: <strong>{fmt(selectedTenant?.contract?.monthly_rent || 0)}</strong>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Mes</label>
                <Select value={String(formMes)} onValueChange={(v) => setFormMes(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Año</label>
                <Input type="number" value={formAno} onChange={(e) => setFormAno(parseInt(e.target.value))} min={2020} max={2035} />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Alquiler (€)</label>
              <Input type="number" step="0.01" value={formAlquiler} onChange={(e) => setFormAlquiler(e.target.value)} placeholder="0.00" />
            </div>

            <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suministros — puedes usar una factura archivada</p>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Gas (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formGas}
                  onChange={(e) => {
                    setFormGas(e.target.value)
                    setSelectedGasExpenseId(null)
                  }}
                  placeholder="0.00"
                  className="bg-white"
                />
                {expensesGas.length > 0 && (
                  <div className="mt-1 space-y-1">
                    <Select value={selectedGasExpenseId ? String(selectedGasExpenseId) : undefined} onValueChange={(val) => setArchivedExpense("gas", val)}>
                      <SelectTrigger className="h-8 text-xs text-slate-600 bg-white border-dashed"><SelectValue placeholder="📎 Usar factura archivada de Gas" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {expensesGas.map((exp) => {
                          const isUsed = data.some(t => t.invoices.some(inv => inv.gas_expense_id === exp.id))
                          return (
                            <SelectItem 
                              key={exp.id} 
                              value={String(exp.id)}
                              className={isUsed ? "bg-red-50 text-red-700 focus:bg-red-100 focus:text-red-800" : ""}
                            >
                              {fmtFecha(exp.date)} — {fmt(exp.amount)}{exp.receipt_url ? " 📄" : ""}
                              {isUsed && " (Ya usado)"}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    {selectedGasExpenseId && <p className="text-[11px] text-blue-600">Este gasto quedará vinculado al recibo.</p>}
                  </div>
                )}
                {loadingExpenses && <p className="text-xs text-slate-400 mt-1">Cargando facturas...</p>}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Luz (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formLuz}
                  onChange={(e) => {
                    setFormLuz(e.target.value)
                    setSelectedLuzExpenseId(null)
                  }}
                  placeholder="0.00"
                  className="bg-white"
                />
                {expensesLuz.length > 0 && (
                  <div className="mt-1 space-y-1">
                    <Select value={selectedLuzExpenseId ? String(selectedLuzExpenseId) : undefined} onValueChange={(val) => setArchivedExpense("luz", val)}>
                      <SelectTrigger className="h-8 text-xs text-slate-600 bg-white border-dashed"><SelectValue placeholder="📎 Usar factura archivada de Luz" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {expensesLuz.map((exp) => {
                          const isUsed = data.some(t => t.invoices.some(inv => inv.luz_expense_id === exp.id))
                          return (
                            <SelectItem 
                              key={exp.id} 
                              value={String(exp.id)}
                              className={isUsed ? "bg-red-50 text-red-700 focus:bg-red-100 focus:text-red-800" : ""}
                            >
                              {fmtFecha(exp.date)} — {fmt(exp.amount)}{exp.receipt_url ? " 📄" : ""}
                              {isUsed && " (Ya usado)"}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    {selectedLuzExpenseId && <p className="text-[11px] text-blue-600">Este gasto quedará vinculado al recibo.</p>}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Agua (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formAgua}
                  onChange={(e) => {
                    setFormAgua(e.target.value)
                    setSelectedAguaExpenseId(null)
                  }}
                  placeholder="0.00"
                  className="bg-white"
                />
                {expensesAgua.length > 0 && (
                  <div className="mt-1 space-y-1">
                    <Select value={selectedAguaExpenseId ? String(selectedAguaExpenseId) : undefined} onValueChange={(val) => setArchivedExpense("agua", val)}>
                      <SelectTrigger className="h-8 text-xs text-slate-600 bg-white border-dashed"><SelectValue placeholder="📎 Usar factura archivada de Agua" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {expensesAgua.map((exp) => {
                          const isUsed = data.some(t => t.invoices.some(inv => inv.agua_expense_id === exp.id))
                          return (
                            <SelectItem 
                              key={exp.id} 
                              value={String(exp.id)}
                              className={isUsed ? "bg-red-50 text-red-700 focus:bg-red-100 focus:text-red-800" : ""}
                            >
                              {fmtFecha(exp.date)} — {fmt(exp.amount)}{exp.receipt_url ? " 📄" : ""}
                              {isUsed && " (Ya usado)"}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    {selectedAguaExpenseId && <p className="text-[11px] text-blue-600">Este gasto quedará vinculado al recibo.</p>}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5 text-slate-500" /> Internet (€)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formInternet}
                  onChange={(e) => {
                    setFormInternet(e.target.value)
                    setSelectedInternetExpenseId(null)
                  }}
                  placeholder="0.00"
                  className="bg-white"
                />
                {expensesInternet.length > 0 && (
                  <div className="mt-1 space-y-1">
                    <Select value={selectedInternetExpenseId ? String(selectedInternetExpenseId) : undefined} onValueChange={(val) => setArchivedExpense("internet", val)}>
                      <SelectTrigger className="h-8 text-xs text-slate-600 bg-white border-dashed"><SelectValue placeholder="📎 Usar factura archivada de Internet" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {expensesInternet.map((exp) => {
                          const isUsed = data.some(t => t.invoices.some(inv => inv.internet_expense_id === exp.id))
                          return (
                            <SelectItem 
                              key={exp.id} 
                              value={String(exp.id)}
                              className={isUsed ? "bg-red-50 text-red-700 focus:bg-red-100 focus:text-red-800" : ""}
                            >
                              {fmtFecha(exp.date)} — {fmt(exp.amount)}{exp.receipt_url ? " 📄" : ""}
                              {isUsed && " (Ya usado)"}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    {selectedInternetExpenseId && <p className="text-[11px] text-blue-600">Este gasto quedará vinculado al recibo.</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <span className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Total a cobrar</span>
              <span className="text-xl font-black text-slate-800">
                {fmt((parseFloat(formAlquiler) || 0) + (parseFloat(formGas) || 0) + (parseFloat(formLuz) || 0) + (parseFloat(formAgua) || 0) + (parseFloat(formInternet) || 0))}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowGenerarForm(false)}>Cancelar</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
                onClick={handleGenerarRecibo}
                disabled={formSaving || !formAlquiler}
              >
                <Receipt className="w-4 h-4" />
                {formSaving ? "Guardando..." : "Crear recibo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
