"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, Users, Receipt, Wrench, Settings, FileSignature, FileText } from "lucide-react"
import { motion } from "framer-motion"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const items = [
  { title: "Dashboard",   url: "/dashboard",           icon: LayoutDashboard, enabled: true },
  { title: "Contratos",   url: "/dashboard/contracts", icon: FileSignature,   enabled: true },
  { title: "Inquilinos",  url: "/dashboard/tenants",   icon: Users,           enabled: true },
  { title: "Recibos",     url: "/dashboard/recibos",   icon: Receipt,         enabled: true },
  { title: "Facturas",    url: "/dashboard/facturas",  icon: FileText,        enabled: true },
  { title: "Inmuebles",   url: "/dashboard/properties", icon: Building2,      enabled: true },
  { title: "Incidencias", url: "#",                    icon: Wrench,          enabled: false },
  { title: "Configuración", url: "#",                  icon: Settings,        enabled: false },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="mb-4 px-1">
            <Link href="/dashboard" className="block">
              <Image
                src="/gestidomus-logo.png"
                alt="GestiDomus"
                width={160}
                height={48}
                className="w-auto h-10 object-contain"
                priority
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement
                  target.style.display = "none"
                  const fallback = target.nextElementSibling as HTMLElement | null
                  if (fallback) fallback.style.display = "flex"
                }}
              />
              <span
                className="hidden items-center gap-2 text-blue-700 font-black text-xl tracking-tight"
                style={{ display: "none" }}
              >
                <Building2 className="w-6 h-6 text-blue-600" />
                GestiDomus
              </span>
            </Link>
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.enabled &&
                  (item.url === "/dashboard"
                    ? pathname === item.url
                    : pathname === item.url || pathname.startsWith(`${item.url}/`))

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      {item.enabled ? (
                        <Link
                          href={item.url}
                          className={`group relative flex items-center gap-3 p-2 rounded-lg transition-colors ${
                            isActive
                              ? "text-blue-700 font-semibold"
                              : "hover:bg-slate-100/50 text-slate-700"
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="active-pill"
                              className="absolute inset-0 bg-blue-50 rounded-lg z-0"
                              transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            />
                          )}
                          <item.icon className={`w-5 h-5 relative z-10 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                          <span className="relative z-10">{item.title}</span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 p-2 rounded-lg text-slate-400 cursor-not-allowed opacity-70">
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">
                            Próximamente
                          </span>
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
