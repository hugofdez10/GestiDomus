import type { SupabaseClient } from "@supabase/supabase-js"

type InvoicePaymentStatus = "pending" | "paid"

type InvoiceLike = {
  id: string
  status: InvoicePaymentStatus | string | null
  paid_at: string | null
  gas_expense_id?: number | null
  luz_expense_id?: number | null
  agua_expense_id?: number | null
  internet_expense_id?: number | null
  utility_attachments?: Array<{ expenseId?: number | null; expense_id?: number | null }> | null
}

function collectInvoiceExpenseIds(invoice: InvoiceLike) {
  const ids = [
    invoice.gas_expense_id,
    invoice.luz_expense_id,
    invoice.agua_expense_id,
    invoice.internet_expense_id,
    ...(Array.isArray(invoice.utility_attachments)
      ? invoice.utility_attachments.map((item) => item.expenseId ?? item.expense_id ?? null)
      : []),
  ]

  return Array.from(
    new Set(
      ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  )
}

export async function syncInvoicePaymentStatusForPropertyMonth(
  supabase: SupabaseClient,
  propertyId: number,
  billingYear: number,
  billingMonth: number
) {
  const rentMonth = billingMonth - 1

  const [rentRes, invoicesRes] = await Promise.all([
    supabase
      .from("rent_payments")
      .select("is_paid")
      .eq("property_id", propertyId)
      .eq("year", billingYear)
      .eq("month", rentMonth),
    supabase
      .from("invoices")
      .select("id, status, paid_at, gas_expense_id, luz_expense_id, agua_expense_id, internet_expense_id, utility_attachments")
      .eq("property_id", propertyId)
      .eq("billing_year", billingYear)
      .eq("billing_month", billingMonth),
  ])

  if (rentRes.error) throw rentRes.error
  if (invoicesRes.error) throw invoicesRes.error

  const invoices = (invoicesRes.data || []) as InvoiceLike[]
  if (invoices.length === 0) return

  const rentPaid = (rentRes.data || []).some((payment) => payment.is_paid)
  const expenseIds = Array.from(new Set(invoices.flatMap(collectInvoiceExpenseIds)))
  const paidExpenseIds = new Set<number>()

  if (expenseIds.length > 0) {
    const { data: expenses, error } = await supabase
      .from("expenses")
      .select("id, is_tenant_paid")
      .in("id", expenseIds)

    if (error) throw error

    ;(expenses || []).forEach((expense) => {
      if (expense.is_tenant_paid !== false) paidExpenseIds.add(Number(expense.id))
    })
  }

  const now = new Date().toISOString()

  await Promise.all(
    invoices.map(async (invoice) => {
      const invoiceExpenseIds = collectInvoiceExpenseIds(invoice)
      const expensesPaid = invoiceExpenseIds.every((id) => paidExpenseIds.has(id))
      const shouldBePaid = rentPaid && expensesPaid
      const nextStatus: InvoicePaymentStatus = shouldBePaid ? "paid" : "pending"

      if (invoice.status === nextStatus) return

      const { error } = await supabase
        .from("invoices")
        .update({
          status: nextStatus,
          paid_at: shouldBePaid ? invoice.paid_at || now : null,
        })
        .eq("id", invoice.id)

      if (error) throw error
    })
  )
}

export async function syncInvoicePaymentStatusForExpense(supabase: SupabaseClient, expenseId: number) {
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("property_id, billing_year, billing_month, gas_expense_id, luz_expense_id, agua_expense_id, internet_expense_id, utility_attachments")

  if (error) throw error

  const affectedMonths = new Map<string, { propertyId: number; billingYear: number; billingMonth: number }>()

  ;((invoices || []) as Array<InvoiceLike & { property_id: number; billing_year: number; billing_month: number }>).forEach((invoice) => {
    if (!collectInvoiceExpenseIds(invoice).includes(expenseId)) return

    const key = `${invoice.property_id}-${invoice.billing_year}-${invoice.billing_month}`
    affectedMonths.set(key, {
      propertyId: invoice.property_id,
      billingYear: invoice.billing_year,
      billingMonth: invoice.billing_month,
    })
  })

  await Promise.all(
    Array.from(affectedMonths.values()).map((month) =>
      syncInvoicePaymentStatusForPropertyMonth(
        supabase,
        month.propertyId,
        month.billingYear,
        month.billingMonth
      )
    )
  )
}
