import { supabase } from "./supabase"

export async function runMonthlyAutomation() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  
  // 1. Buscamos gastos marcados como recurrentes
  const { data: recurringTemplates } = await supabase
    .from('expenses')
    .select('*')
    .eq('is_recurring', true)

  if (!recurringTemplates) return { message: "No hay gastos recurrentes configurados." }

  const newExpenses = []

  for (const template of recurringTemplates) {
    // Verificamos si ya existe este gasto este mes para evitar duplicados
    const { data: existing } = await supabase
      .from('expenses')
      .select('id')
      .eq('property_id', template.property_id)
      .eq('category', template.category)
      .gte('date', `${currentYear}-${currentMonth}-01`)
      .lte('date', `${currentYear}-${currentMonth}-31`)

    if (existing && existing.length === 0) {
      // Si no existe, preparamos la clonación para el día actual
      newExpenses.push({
        property_id: template.property_id,
        category: template.category,
        amount: template.amount,
        date: now.toISOString().split('T')[0],
        is_recurring: true
      })
    }
  }

  if (newExpenses.length > 0) {
    const { error } = await supabase.from('expenses').insert(newExpenses)
    if (error) throw error
    return { message: `Se han generado ${newExpenses.length} gastos automáticos.` }
  }

  return { message: "Todo está al día. No se requirieron nuevos registros." }
}