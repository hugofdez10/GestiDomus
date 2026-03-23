import { supabase } from "@/lib/supabase"

export async function deleteContract(contractId: string) {
  const { error: txError } = await supabase
    .from("transactions")
    .delete()
    .eq("contract_id", contractId)

  if (txError) throw txError

  const { error: invoicesError } = await supabase
    .from("invoices")
    .delete()
    .eq("contract_id", contractId)

  if (invoicesError) throw invoicesError

  const { error: contractError } = await supabase
    .from("contracts")
    .delete()
    .eq("id", contractId)

  if (contractError) throw contractError
}