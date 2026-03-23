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
} from "lucide-react"

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
  end_date: string
  properties?: { name: string; address: string | null }[] | null
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
  status: "pending" | "paid"
  sent_at: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
}

// Gasto archivado para los desplegables
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
  invoices: Invoice[]
  pendingTotal: number
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function fmtFecha(s: string | null) {
  if (!s) return "—"
  const [y, m, d] = s.split("-")
  return `${d}/${m}/${y}`
}

function totalInvoice(inv: Invoice) {
  return inv.amount + (inv.gas || 0) + (inv.luz || 0) + (inv.agua || 0) + (inv.internet || 0)
}

function mesAno(inv: Invoice) {
  return `${MESES[inv.billing_month - 1]} ${inv.billing_year}`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function RecibosPage() {
  const [data, setData] = useState<TenantWithContract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedTenant, setSelectedTenant] = useState<TenantWithContract | null>(null)
  const [expandedTenants, setExpandedTenants] = useState<Set<number>>(new Set())

  // Modales
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [showGenerarForm, setShowGenerarForm] = useState(false)

  // Formulario nuevo recibo
  const [formMes, setFormMes] = useState(new Date().getMonth() + 1)
  const [formAno, setFormAno] = useState(new Date().getFullYear())
  const [formAlquiler, setFormAlquiler] = useState("")
  const [formGas, setFormGas] = useState("")
  const [formLuz, setFormLuz] = useState("")
  const [formAgua, setFormAgua] = useState("")
  const [formInternet, setFormInternet] = useState("")
  const [formSaving, setFormSaving] = useState(false)

  // Gastos archivados para los desplegables
  const [expensesGas, setExpensesGas] = useState<Expense[]>([])
  const [expensesLuz, setExpensesLuz] = useState<Expense[]>([])
  const [expensesAgua, setExpensesAgua] = useState<Expense[]>([])
  const [expensesInternet, setExpensesInternet] = useState<Expense[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)

  // ─── Carga de datos ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true)

    const [tenantsRes, contractsRes, invoicesRes] = await Promise.all([
      supabase.from("tenants").select("id, full_name, email, phone").order("full_name"),
      supabase
        .from("contracts")
        .select("id, property_id, tenant_id, monthly_rent, contract_status, start_date, end_date, properties(name, address)")
        .in("contract_status", ["activo", "prorrogado", "vencido"]),
      supabase
        .from("invoices")
        .select("id, contract_id, property_id, tenant_id, billing_year, billing_month, billing_period, due_date, amount, gas, luz, agua, internet, status, sent_at, paid_at, notes, created_at")
        .order("billing_year", { ascending: false })
        .order("billing_month", { ascending: false }),
    ])

    const tenants: Tenant[] = tenantsRes.data || []
    const contracts: Contract[] = (contractsRes.data as Contract[]) || []
    const invoices: Invoice[] = invoicesRes.data || []

    const merged: TenantWithContract[] = tenants.map((t) => {
      const contract = contracts.find((c) => c.tenant_id === t.id) || null
      const tenantInvoices = invoices.filter((i) => i.tenant_id === t.id)
      const pendingTotal = tenantInvoices
        .filter((i) => i.status === "pending")
        .reduce((s, i) => s + totalInvoice(i), 0)
      return { ...t, contract, invoices: tenantInvoices, pendingTotal }
    })

    setData(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── Cargar gastos archivados para un inmueble ────────────────────────────

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

  // ─── Filtrado ────────────────────────────────────────────────────────────────

  const filtered = data.filter((t) =>
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.email || "").toLowerCase().includes(search.toLowerCase())
  )

  const hasActiveContract = (t: TenantWithContract) =>
    t.contract && ["activo", "prorrogado"].includes(t.contract.contract_status)

  // ─── Acciones ────────────────────────────────────────────────────────────────

  function openGenerarRecibo(tenant: TenantWithContract) {
    setSelectedTenant(tenant)
    setFormMes(new Date().getMonth() + 1)
    setFormAno(new Date().getFullYear())
    setFormAlquiler(String(tenant.contract?.monthly_rent || ""))
    setFormGas("")
    setFormLuz("")
    setFormAgua("")
    setFormInternet("")
    setShowGenerarForm(true)
    if (tenant.contract?.property_id) {
      fetchExpensesForProperty(tenant.contract.property_id)
    }
  }

  async function handleGenerarRecibo() {
    if (!selectedTenant?.contract) return

    const mes = formMes
    const ano = formAno

    const existe = selectedTenant.invoices.find(
      (i) => i.billing_year === ano && i.billing_month === mes
    )
    if (existe) {
      alert(`Ya existe un recibo para ${MESES[mes - 1]} ${ano}`)
      return
    }

    setFormSaving(true)

    const pad = (n: number) => String(n).padStart(2, "0")
    const billingPeriod = `${ano}-${pad(mes)}-01`
    const dueDate = `${ano}-${pad(mes)}-05`

    const payload = {
      contract_id: selectedTenant.contract.id,
      property_id: selectedTenant.contract.property_id,
      tenant_id: selectedTenant.id,
      billing_year: ano,
      billing_month: mes,
      billing_period: billingPeriod,
      due_date: dueDate,
      amount: parseFloat(formAlquiler) || 0,
      gas: parseFloat(formGas) || 0,
      luz: parseFloat(formLuz) || 0,
      agua: parseFloat(formAgua) || 0,
      internet: parseFloat(formInternet) || 0,
      status: "pending",
      notes: `Recibo ${MESES[mes - 1]} ${ano}`,
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
    const update: any = {
      status: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
    }
    const { error } = await supabase.from("invoices").update(update).eq("id", inv.id)
    if (!error) {
      setViewInvoice((prev) => (prev?.id === inv.id ? { ...prev, ...update } : prev))
      fetchAll()
    }
  }

  async function markSent(inv: Invoice) {
    const { error } = await supabase
      .from("invoices")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", inv.id)
    if (!error) {
      setViewInvoice((prev) => (prev?.id === inv.id ? { ...prev, sent_at: new Date().toISOString() } : prev))
      fetchAll()
      alert(`✅ Recibo marcado como enviado a ${selectedTenant?.email || "el inquilino"}`)
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

  // ─── Receipt preview helpers ─────────────────────────────────────────────────

  function getInvoiceTenant(inv: Invoice): TenantWithContract | undefined {
    return data.find((t) => t.id === inv.tenant_id)
  }

  function handlePrint() {
    window.print()
  }

  // ─── Helper: desplegable de facturas archivadas ───────────────────────────

  function ExpenseSelect({
    expenses,
    onSelect,
    loading,
    label,
  }: {
    expenses: Expense[]
    onSelect: (amount: string) => void
    loading: boolean
    label: string
  }) {
    if (loading) return <p className="text-xs text-slate-400">Cargando facturas...</p>
    if (expenses.length === 0) return null
    return (
      <div className="mt-1">
        <Select
          onValueChange={(val) => {
            if (val !== "manual") onSelect(val)
          }}
        >
          <SelectTrigger className="h-8 text-xs text-slate-600 bg-slate-50 border-dashed">
            <SelectValue placeholder={`📎 Usar factura archivada de ${label}`} />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {expenses.map((exp) => (
              <SelectItem key={exp.id} value={String(exp.amount)}>
                {fmtFecha(exp.date)} — {fmt(exp.amount)}
                {exp.receipt_url ? " 📄" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // ─── Totales globales ─────────────────────────────────────────────────────────

  const totalPendiente = data.reduce((s, t) => s + t.pendingTotal, 0)
  const totalRecibos = data.reduce((s, t) => s + t.invoices.length, 0)
  const totalPendienteCount = data.reduce(
    (s, t) => s + t.invoices.filter((i) => i.status === "pending").length,
    0
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      {/* Cabecera */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <Receipt className="w-7 h-7 text-blue-600" />
            Recibos de Alquiler
          </h1>
          <p className="text-slate-500 mt-2">
            Genera, consulta y envía los recibos mensuales de cada inquilino.
          </p>
        </div>
      </div>

      {/* Métricas rápidas */}
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

      {/* Buscador */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar inquilino o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Lista de inquilinos */}
      {loading ? (
        <div className="flex justify-center py-20 text-slate-400">Cargando datos...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((tenant) => {
            const expanded = expandedTenants.has(tenant.id)
            const isActive = hasActiveContract(tenant)
            const property = tenant.contract?.properties?.[0]

            return (
              <div
                key={tenant.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Fila cabecera */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(tenant.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                    {tenant.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800">{tenant.full_name}</p>
                      {isActive ? (
                        <Badge className="bg-green-100 text-green-800 text-[10px]">Activo</Badge>
                      ) : tenant.contract ? (
                        <Badge className="bg-slate-100 text-slate-600 text-[10px]">
                          {tenant.contract.contract_status}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-400 text-[10px]">Sin contrato</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {property?.name || property?.address || "Sin propiedad asignada"}
                    </p>
                  </div>

                  {/* Stats */}
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
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Historial expandido */}
                {expanded && (
                  <div className="border-t border-slate-100">
                    {tenant.invoices.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No hay recibos todavía</p>
                        {isActive && (
                          <button
                            className="mt-2 text-blue-600 text-xs underline"
                            onClick={() => openGenerarRecibo(tenant)}
                          >
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
                          {tenant.invoices.map((inv) => (
                            <TableRow key={inv.id} className="hover:bg-slate-50">
                              <TableCell>
                                <p className="font-semibold text-slate-700">{mesAno(inv)}</p>
                                <p className="text-xs text-slate-400">
                                  Vence: {fmtFecha(inv.due_date)}
                                </p>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-slate-600">
                                {fmt(inv.amount)}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-slate-500">
                                {(inv.gas || inv.luz || inv.agua || inv.internet) ? (
                                  <span>
                                    {inv.gas ? `Gas ${fmt(inv.gas)} · ` : ""}
                                    {inv.luz ? `Luz ${fmt(inv.luz)} · ` : ""}
                                    {inv.agua ? `Agua ${fmt(inv.agua)}` : ""}
                                    {inv.internet ? ` · Internet ${fmt(inv.internet)}` : ""}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </TableCell>
                              <TableCell className="font-bold text-slate-800">
                                {fmt(totalInvoice(inv))}
                              </TableCell>
                              <TableCell>
                                {inv.status === "paid" ? (
                                  <Badge className="bg-green-100 text-green-800 text-[10px] gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Pagado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1">
                                    <Clock className="w-3 h-3" /> Pendiente
                                  </Badge>
                                )}
                                {inv.sent_at && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Enviado {fmtFecha(inv.sent_at.split("T")[0])}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  title="Ver recibo"
                                  onClick={() => {
                                    setSelectedTenant(tenant)
                                    setViewInvoice(inv)
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
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

      {/* ─── Modal: Ver recibo ─────────────────────────────────────────────── */}
      <Dialog open={!!viewInvoice} onOpenChange={(o) => !o && setViewInvoice(null)}>
        <DialogContent className="w-[95vw] max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>
              Recibo · {viewInvoice ? mesAno(viewInvoice) : ""}
            </DialogTitle>
          </DialogHeader>

          {viewInvoice && (() => {
            const tenant = getInvoiceTenant(viewInvoice)
            const contract = tenant?.contract
            const prop = contract?.properties?.[0]
            const propertyAddr = prop?.address || prop?.name || "—"
            const total = totalInvoice(viewInvoice)

            // Filas de suministros (solo las que tienen valor > 0)
            const suministros: [string, number][] = [
              ["Gas:", viewInvoice.gas || 0],
              ["Luz:", viewInvoice.luz || 0],
              ["Agua:", viewInvoice.agua || 0],
              ["Internet:", viewInvoice.internet || 0],
            ].filter(([, val]) => (val as number) > 0) as [string, number][]

            return (
              <div>
                {/* Recibo visual */}
                <div
                  id="recibo-print"
                  className="font-mono text-sm border border-slate-200 rounded-lg p-5 bg-white"
                >
                  <h2 className="text-lg font-black border-b-2 border-slate-800 pb-3 mb-4 tracking-tight">
                    RECIBO DE ALQUILER — {MESES[viewInvoice.billing_month - 1].toUpperCase()}{" "}
                    {viewInvoice.billing_year}
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
                        <tr key={label} className="border border-slate-200">
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
                      <p className="font-semibold">{ARRENDADOR.nombre}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">IBAN</p>
                      <p className="font-semibold">{ARRENDADOR.iban}</p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-0.5">
                    <p>Fecha emisión: {fmtFecha(viewInvoice.billing_period)}</p>
                    <p>Sin repercusión de IVA (arrendamiento de vivienda).</p>
                    {viewInvoice.sent_at && (
                      <p>Enviado: {new Date(viewInvoice.sent_at).toLocaleDateString("es-ES")}</p>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2 mt-4 justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={handlePrint}
                    >
                      <Printer className="w-4 h-4" /> Imprimir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteInvoice(viewInvoice)}
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={viewInvoice.status === "paid" ? "outline" : "default"}
                      className={
                        viewInvoice.status === "paid"
                          ? "gap-1 border-green-300 text-green-700"
                          : "gap-1 bg-green-600 hover:bg-green-700 text-white"
                      }
                      onClick={() => togglePaid(viewInvoice)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {viewInvoice.status === "paid" ? "Marcar pendiente" : "Marcar pagado"}
                    </Button>

                    <Button
                      size="sm"
                      className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => markSent(viewInvoice)}
                      disabled={!!viewInvoice.sent_at}
                    >
                      <Send className="w-4 h-4" />
                      {viewInvoice.sent_at ? "Ya enviado" : "Marcar enviado"}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Generar recibo ──────────────────────────────────────────── */}
      <Dialog open={showGenerarForm} onOpenChange={setShowGenerarForm}>
        <DialogContent className="w-[95vw] max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Nuevo recibo — {selectedTenant?.full_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Aviso */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              Inmueble:{" "}
              <strong>
                {selectedTenant?.contract?.properties?.[0]?.name ||
                  selectedTenant?.contract?.properties?.[0]?.address ||
                  "—"}
              </strong>
              <br />
              Alquiler base contractual:{" "}
              <strong>{fmt(selectedTenant?.contract?.monthly_rent || 0)}</strong>
            </div>

            {/* Mes y año */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Mes</label>
                <Select
                  value={String(formMes)}
                  onValueChange={(v) => setFormMes(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Año</label>
                <Input
                  type="number"
                  value={formAno}
                  onChange={(e) => setFormAno(parseInt(e.target.value))}
                  min={2020}
                  max={2035}
                />
              </div>
            </div>

            {/* Alquiler */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">
                Alquiler (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={formAlquiler}
                onChange={(e) => setFormAlquiler(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Suministros — con desplegables de facturas */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Suministros — puedes usar una factura archivada
              </p>

              {/* Gas */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Gas (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formGas}
                  onChange={(e) => setFormGas(e.target.value)}
                  placeholder="0.00"
                  className="bg-white"
                />
                {expensesGas.length > 0 && (
                  <div className="mt-1">
                    <Select onValueChange={(val) => setFormGas(val)}>
                      <SelectTrigger className="h-8 text-xs text-slate-600 bg-white border-dashed">
                        <SelectValue placeholder="📎 Usar factura archivada de Gas" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {expensesGas.map((exp) => (
                          <SelectItem key={exp.id} value={String(exp.amount)}>
                            {fmtFecha(exp.date)} — {fmt(exp.amount)}{exp.receipt_url ? " 📄" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {loadingExpenses && (
                  <p className="text-xs text-slate-400 mt-1">Cargando facturas...</p>
                )}
              </div>

              {/* Luz */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Luz (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formLuz}
                  onChange={(e) => setFormLuz(e.target.value)}
                  placeholder="0.00"
                  className="bg-white"
                />
                {expensesLuz.length > 0 && (
                  <div className="mt-1">
                    <Select onValueChange={(val) => setFormLuz(val)}>
                      <SelectTrigger className="h-8 text-xs text-slate-600 bg-white border-dashed">
                        <SelectValue placeholder="📎 Usar factura archivada de Luz" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {expensesLuz.map((exp) => (
                          <SelectItem key={exp.id} value={String(exp.amount)}>
                            {fmtFecha(exp.date)} — {fmt(exp.amount)}{exp.receipt_url ? " 📄" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Agua */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Agua (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formAgua}
                  onChange={(e) => setFormAgua(e.target.value)}
                  placeholder="0.00"
                  className="bg-white"
                />
                {expensesAgua.length > 0 && (
                  <div className="mt-1">
                    <Select onValueChange={(val) => setFormAgua(val)}>
                      <SelectTrigger className="h-8 text-xs text-slate-600 bg-white border-dashed">
                        <SelectValue placeholder="📎 Usar factura archivada de Agua" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {expensesAgua.map((exp) => (
                          <SelectItem key={exp.id} value={String(exp.amount)}>
                            {fmtFecha(exp.date)} — {fmt(exp.amount)}{exp.receipt_url ? " 📄" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Internet */}
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5 text-slate-500" /> Internet (€)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formInternet}
                  onChange={(e) => setFormInternet(e.target.value)}
                  placeholder="0.00"
                  className="bg-white"
                />
                {expensesInternet.length > 0 && (
                  <div className="mt-1">
                    <Select onValueChange={(val) => setFormInternet(val)}>
                      <SelectTrigger className="h-8 text-xs text-slate-600 bg-white border-dashed">
                        <SelectValue placeholder="📎 Usar factura archivada de Internet" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {expensesInternet.map((exp) => (
                          <SelectItem key={exp.id} value={String(exp.amount)}>
                            {fmtFecha(exp.date)} — {fmt(exp.amount)}{exp.receipt_url ? " 📄" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Total en tiempo real */}
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <span className="text-sm text-slate-500 font-semibold uppercase tracking-wider">
                Total a cobrar
              </span>
              <span className="text-xl font-black text-slate-800">
                {fmt(
                  (parseFloat(formAlquiler) || 0) +
                    (parseFloat(formGas) || 0) +
                    (parseFloat(formLuz) || 0) +
                    (parseFloat(formAgua) || 0) +
                    (parseFloat(formInternet) || 0)
                )}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowGenerarForm(false)}>
                Cancelar
              </Button>
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