"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, Users, Receipt, Wrench, Settings, FileSignature } from "lucide-react"
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
  { title: "Inmuebles",   url: "#",                    icon: Building2,       enabled: false },
  { title: "Incidencias", url: "#",                    icon: Wrench,          enabled: false },
  { title: "Configuración", url: "#",                  icon: Settings,        enabled: false },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-blue-600 font-bold text-lg mb-4">
            GestiDomus
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.enabled &&
                  (pathname === item.url || pathname.startsWith(`${item.url}/`))

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      {item.enabled ? (
                        <Link
                          href={item.url}
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                            isActive
                              ? "bg-blue-50 text-blue-700 font-semibold"
                              : "hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
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