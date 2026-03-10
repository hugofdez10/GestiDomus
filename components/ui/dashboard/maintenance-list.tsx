"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { CheckCircle2, Calendar, Hammer, Euro } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function MaintenanceList() {
  const [tasks, setTasks] = useState<any[]>([])
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [amount, setAmount] = useState("")

  async function fetchTasks() {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .select('*, properties(name)')
      .order('due_date', { ascending: true })
    if (!error && data) setTasks(data)
  }

  useEffect(() => { fetchTasks() }, [])

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'Crítica': return 'bg-red-100 text-red-700 border-red-200'
      case 'Alta': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'Media': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  async function handleComplete(task: any) {
    if (task.status === 'Pendiente') {
      setSelectedTask(task)
      setShowExpenseModal(true)
    } else {
      await supabase.from('maintenance_tasks').update({ status: 'Pendiente' }).eq('id', task.id)
      fetchTasks()
    }
  }

  async function saveExpenseAndComplete() {
    // 1. Marcar tarea como completada
    await supabase.from('maintenance_tasks').update({ status: 'Completado' }).eq('id', selectedTask.id)
    
    // 2. Si hay importe, crear el gasto automáticamente
    if (parseFloat(amount) > 0) {
      await supabase.from('expenses').insert([{
        property_id: selectedTask.property_id,
        category: `Mantenimiento: ${selectedTask.title}`,
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0]
      }])
    }

    setShowExpenseModal(false)
    setAmount("")
    fetchTasks()
  }

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
      {tasks.map((task) => (
        <div key={task.id} className={`flex items-center justify-between p-4 bg-white rounded-lg border-l-4 shadow-sm transition-all ${task.status === 'Completado' ? 'opacity-60 grayscale' : ''}`} 
             style={{ borderLeftColor: task.priority === 'Crítica' ? '#ef4444' : task.priority === 'Alta' ? '#f97316' : '#3b82f6' }}>
          <div className="flex items-start gap-3">
            <button onClick={() => handleComplete(task)} className="mt-1">
              <CheckCircle2 className={`w-5 h-5 ${task.status === 'Completado' ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-400'}`} />
            </button>
            <div>
              <p className={`font-bold text-sm ${task.status === 'Completado' ? 'line-through' : 'text-slate-800'}`}>{task.title}</p>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{task.properties?.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={`text-[9px] font-bold ${getPriorityStyles(task.priority)}`}>
                  {task.priority}
                </Badge>
                <span className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {task.due_date}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Modal de Gasto Automático */}
      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Euro className="w-5 h-5 text-emerald-600" /> Registrar Gasto de Reparación
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-500 mb-4">Has completado: <strong>{selectedTask?.title}</strong>. ¿Cuánto ha costado la factura? (Deja 0 si no hubo coste)</p>
            <Input 
              type="number" 
              placeholder="Importe en €" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-bold"
            />
          </div>
          <DialogFooter>
            <Button onClick={saveExpenseAndComplete} className="bg-emerald-600 text-white w-full">Finalizar y Guardar Gasto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}