"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/ui/dashboard/app-sidebar"
import { LogOut } from "lucide-react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    // 1. Función que comprueba si hay un usuario válido
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // Si no hay sesión, lo expulsamos a la página de inicio
        router.push("/")
      } else {
        // Si hay sesión, le dejamos ver el contenido
        setIsAuthorized(true)
      }
    }

    checkUser()

    // 2. Escuchamos por si el usuario decide cerrar sesión manualmente
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push("/")
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  // Función para cerrar sesión con el botón
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    // El onAuthStateChange de arriba detectará esto y nos mandará a "/"
  }

  // Mientras comprueba la seguridad, mostramos una pantalla de carga muy rápida
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">
          Verificando credenciales...
        </p>
      </div>
    )
  }

  // Si está autorizado, le mostramos el Panel de Control
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 bg-slate-50 overflow-y-auto">
          
          {/* BARRA SUPERIOR CON BOTÓN DE CERRAR SESIÓN */}
          <div className="p-4 border-b bg-white flex items-center justify-between sticky top-0 z-10 shadow-sm">
            <div className="flex items-center">
              <SidebarTrigger />
              <span className="ml-4 font-bold text-slate-800 uppercase tracking-widest text-xs">
                GestiDomus Workspace
              </span>
            </div>
            
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              CERRAR SESIÓN
            </button>
          </div>

          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}