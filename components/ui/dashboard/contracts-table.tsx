"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, FileText, Search, ShieldCheck } from "lucide-react"

type InvoiceMap = Record<string, { id: string; status: string }>

const contractStatusMap: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  signed: "Firmado",
  active: "Activo",
  expired: "Vencido",
  terminated: "Rescindido",
}

const depositStatusMap: Record<string, string> = {
  pending: "Pendiente",
  received: "Recibida",
  returned: "Devuelta",
  partially_returned: "Devuelta parcial",
  withheld: "Retenida",
}

function getContractStatusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "signed":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "sent":
      return "bg-amber-100 text-amber-700 border-amber-200"
    case "expired":
    case "terminated":
      return "bg-red-100 text-red-700 border-red-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function getDepositStatusClass(status: string) {
  switch (status) {
    case "received":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "returned":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "partially_returned":
      return "bg-orange-100 text-orange-700 border-orange-200"
    case "withheld":
      return "bg-red-100 text-red-700 border-red-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function getInvoiceStatusClass(status?: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "overdue":
      return "bg-red-100 text-red-700 border-red-200"
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function getInvoiceLabel(status?: string) {
  if (!status) return "Sin recibo"
  if (status === "paid") return "Cobrado"
  if (status === "overdue") return "Vencido"
  if (status === "pending") return "Pendiente"
  return status
}

export function ContractsTable() {
  const [contracts, setContracts] = useState<any[]>([])
  const [invoiceMap, setInvoiceMap] = useState<InvoiceMap>({})
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  async function fetchData() {
    setLoading(true)

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const [contractsRes, invoicesRes] = await Promise.all([
      supabase
        .from("contracts")
        .select(`
          id,
          property_id,
          tenant_id,
          contract_code,
          start_date,
          end_date,
          monthly_rent,
          deposit_amount,
          contract_status,
          deposit_status,
          document_path,
          properties(id, name),
          tenants(id, full_name, email, phone)
        `)
        .order("end_date", { ascending: true }),
      supabase
        .from("invoices")
        .select("id, contract_id, status")
        .eq("billing_year", currentYear)
        .eq("billing_month", currentMonth),
    ])

    if (contractsRes.error) {
      alert("Error al cargar contratos: " + contractsRes.error.message)
      setLoading(false)
      return
    }

    if (invoicesRes.error) {
      alert("Error al cargar recibos: " + invoicesRes.error.message)
      setLoading(false)
      return
    }

    const nextInvoiceMap: InvoiceMap = {}
      ; (invoicesRes.data || []).forEach((invoice: any) => {
        nextInvoiceMap[invoice.contract_id] = { id: invoice.id, status: invoice.status }
      })

    setContracts(contractsRes.data || [])
    setInvoiceMap(nextInvoiceMap)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesStatus = statusFilter === "all" || contract.contract_status === statusFilter
      const needle = search.trim().toLowerCase()

      const matchesSearch =
        needle.length === 0 ||
        contract.contract_code?.toLowerCase().includes(needle) ||
        contract.properties?.name?.toLowerCase().includes(needle) ||
        contract.tenants?.full_name?.toLowerCase().includes(needle) ||
        contract.tenants?.email?.toLowerCase().includes(needle) ||
        contract.tenants?.phone?.toLowerCase().includes(needle)

      return matchesStatus && matchesSearch
    })
  }, [contracts, search, statusFilter])

  async function handleRegisterPayment(contract: any) {
    if (!window.confirm(`¿Registrar el cobro del mes actual para ${contract.properties?.name}?`)) return

    const now = new Date()
    const billingYear = now.getFullYear()
    const billingMonth = now.getMonth() + 1
    const paddedMonth = String(billingMonth).padStart(2, "0")
    const dueDate = `${billingYear}-${paddedMonth}-05`
    const billingPeriod = `${billingYear}-${paddedMonth}-01`

    setPayingId(contract.id)

    let invoiceId = invoiceMap[contract.id]?.id
    let invoiceStatus = invoiceMap[contract.id]?.status

    if (!invoiceId) {
      const { data: upsertedInvoice, error: invoiceUpsertError } = await supabase
        .from("invoices")
        .upsert(
          [
            {
              contract_id: contract.id,
              property_id: contract.property_id,
              tenant_id: contract.tenant_id,
              billing_year: billingYear,
              billing_month: billingMonth,
              billing_period: billingPeriod,
              due_date: dueDate,
              amount: contract.monthly_rent,
              status: "pending",
            },
          ],
          { onConflict: "contract_id,billing_year,billing_month" }
        )
        .select("id, status")
        .single()

      if (invoiceUpsertError || !upsertedInvoice) {
        alert("Error al crear el recibo: " + (invoiceUpsertError?.message || "Sin detalle"))
        setPayingId(null)
        return
      }

      invoiceId = upsertedInvoice.id
      invoiceStatus = upsertedInvoice.status
    }

    if (invoiceStatus === "paid") {
      alert("Este recibo ya está marcado como cobrado.")
      setPayingId(null)
      return
    }

    const paidAt = new Date().toISOString()

    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", invoiceId)

    if (invoiceUpdateError) {
      alert("Error al marcar el recibo como cobrado: " + invoiceUpdateError.message)
      setPayingId(null)
      return
    }

    const { data: existingTransaction } = await supabase
      .from("transactions")
      .select("id")
      .eq("invoice_id", invoiceId)
      .eq("type", "income")
      .maybeSingle()

    if (!existingTransaction) {
      const { error: transactionError } = await supabase.from("transactions").insert([
        {
          property_id: contract.property_id,
          tenant_id: contract.tenant_id,
          contract_id: contract.id,
          invoice_id: invoiceId,
          type: "income",
          category: "rent",
          amount: contract.monthly_rent,
          effective_date: paidAt.split("T")[0],
          status: "confirmed",
          payment_method: "manual",
          source: "contracts-table",
          notes: "Cobro registrado manualmente desde la tabla de contratos",
        },
      ])

      if (transactionError) {
        alert("El recibo se ha marcado como cobrado, pero falló el ledger: " + transactionError.message)
        setPayingId(null)
        fetchData()
        return
      }
    }

    alert("✅ Cobro registrado correctamente.")
    setPayingId(null)
    fetchData()
  }

  return (
    <div className="bg-white p-5 lg:p-6 rounded-xl border shadow-sm w-full overflow-hidden">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Control de Contratos
          </h2>
          <p className="text-sm text-slate-500">
            Contrato, fianza y estado de cobro del mes actual.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
          <div className="relative w-full sm:w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contrato"
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[170px] bg-white">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="signed">Firmado</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="expired">Vencido</SelectItem>
              <SelectItem value="terminated">Rescindido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table className="table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[18%]">Inmueble</TableHead>
              <TableHead className="w-[16%]">Inquilino</TableHead>
              <TableHead className="w-[16%]">Contacto</TableHead>
              <TableHead className="w-[14%]">Contrato</TableHead>
              <TableHead className="w-[12%]">Fianza</TableHead>
              <TableHead className="w-[14%]">Vigencia</TableHead>
              <TableHead className="w-[10%]">Estado</TableHead>
              <TableHead className="w-[10%]">Cobro mes</TableHead>
              <TableHead className="w-[12%] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                  Cargando contratos...
                </TableCell>
              </TableRow>
            ) : filteredContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                  No hay contratos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              filteredContracts.map((contract) => {
                const currentInvoice = invoiceMap[contract.id]
                const canCollect = ["active", "signed"].includes(contract.contract_status)

                return (
                  <TableRow key={contract.id} className="hover:bg-slate-50/60">
                    <TableCell className="align-top">
                      <p className="font-semibold text-slate-800 leading-snug break-words">
                        {contract.properties?.name || "—"}
                      </p>
                    </TableCell>

                    <TableCell className="align-top">
                      <p className="font-semibold text-slate-800 leading-snug break-words">
                        {contract.tenants?.full_name || "—"}
                      </p>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="text-sm leading-snug text-slate-600 break-words">
                        <p>{contract.tenants?.email || "Sin email"}</p>
                        <p className="text-slate-400">{contract.tenants?.phone || "Sin teléfono"}</p>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex flex-col leading-snug">
                        <span className="font-bold text-slate-800 break-words">
                          {contract.contract_code}
                        </span>
                        <span className="text-xs text-slate-400">
                          {Number(contract.monthly_rent || 0).toLocaleString("es-ES")} € / mes
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-sm font-semibold">
                          {Number(contract.deposit_amount || 0).toLocaleString("es-ES")} €
                        </span>
                        <Badge
                          variant="outline"
                          className={`${getDepositStatusClass(contract.deposit_status)} whitespace-normal`}
                        >
                          {depositStatusMap[contract.deposit_status] || contract.deposit_status}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="text-sm leading-snug text-slate-600">
                        <p>
                          <span className="font-medium text-slate-800">Inicio:</span> {contract.start_date}
                        </p>
                        <p>
                          <span className="font-medium text-slate-800">Fin:</span> {contract.end_date}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge
                        variant="outline"
                        className={`${getContractStatusClass(contract.contract_status)} whitespace-normal`}
                      >
                        {contractStatusMap[contract.contract_status] || contract.contract_status}
                      </Badge>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge
                        variant="outline"
                        className={`${getInvoiceStatusClass(currentInvoice?.status)} whitespace-normal`}
                      >
                        {getInvoiceLabel(currentInvoice?.status)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <div className="flex justify-end items-start gap-2">
                        {contract.document_path && (
                          <a
                            href={contract.document_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full hover:bg-indigo-50 text-indigo-600 shrink-0"
                            title="Ver contrato"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleRegisterPayment(contract)}
                          disabled={!canCollect || payingId === contract.id || currentInvoice?.status === "paid"}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {payingId === contract.id
                            ? "Guardando..."
                            : currentInvoice?.status === "paid"
                              ? "Cobrado"
                              : "Registrar cobro"}
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
    </div>
  )
}
