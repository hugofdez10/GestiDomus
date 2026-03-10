import { LayoutDashboard, Building2, Users, Receipt, Wrench, Settings } from "lucide-react"
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

// Menú de navegación
const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Inmuebles", url: "#", icon: Building2 },
  { title: "Inquilinos", url: "#", icon: Users },
  { title: "Facturación", url: "#", icon: Receipt },
  { title: "Incidencias", url: "#", icon: Wrench },
  { title: "Configuración", url: "#", icon: Settings },
]

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-blue-600 font-bold text-lg mb-4">GestiDomus</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded-lg">
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}