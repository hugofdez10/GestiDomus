"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        // INICIAR SESIÓN
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })
        if (error) throw error
        router.push("/dashboard") // Redirige al panel si va bien
      } else {
        // REGISTRARSE
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        })
        if (error) throw error
        alert("Cuenta creada con éxito. Redirigiendo...")
        router.push("/dashboard")
      }
    } catch (err: any) {
      setError(err.message || "Ha ocurrido un error al intentar acceder.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      
      {/* LADO IZQUIERDO: Branding y Propuesta de Valor */}
      <div className="md:w-1/2 bg-blue-700 p-12 text-white flex flex-col justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        
        <div className="relative z-10 max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-12">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              GestiDomus <span className="text-blue-300">OS</span>
            </h1>
          </div>
          
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            El sistema operativo definitivo para inversores inmobiliarios.
          </h2>
          <p className="text-blue-100 text-lg mb-8 leading-relaxed">
            Controla tus activos, monitoriza tus rentabilidades en tiempo real, gestiona contratos y olvídate de los Excel para siempre. Todo tu patrimonio, a un clic de distancia.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-blue-50">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Datos cifrados de extremo a extremo</span>
            </div>
            <div className="flex items-center gap-3 text-blue-50">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Cálculo automático de IRPF y Amortizaciones</span>
            </div>
            <div className="flex items-center gap-3 text-blue-50">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Conexión directa con inquilinos vía WhatsApp</span>
            </div>
          </div>
        </div>
      </div>

      {/* LADO DERECHO: Formulario de Auth */}
      <div className="md:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-800">
              {isLogin ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </h2>
            <p className="text-slate-500 mt-2">
              {isLogin ? "Introduce tus credenciales para acceder a tu panel." : "Únete y digitaliza tu gestión patrimonial hoy mismo."}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
              {error === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="tu@correo.com" 
                  className="pl-10"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Contraseña</Label>
                {isLogin && <a href="#" className="text-xs text-blue-600 hover:underline font-bold">¿Olvidaste tu contraseña?</a>}
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-bold group">
              {loading ? "Procesando..." : (isLogin ? "Acceder al Dashboard" : "Crear mi cuenta gratis")}
              {!loading && <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500 border-t pt-6">
            {isLogin ? "¿No tienes cuenta en GestiDomus?" : "¿Ya eres usuario?"}{" "}
            <button 
              type="button" 
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
              }}
              className="text-blue-600 font-bold hover:underline"
            >
              {isLogin ? "Regístrate aquí" : "Inicia sesión"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}