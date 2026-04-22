import { Link, useRouterState } from "@tanstack/react-router"
import {
  Chart01Icon,
  HelpCircleIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-row items-center gap-2 border-b border-sidebar-border px-2 py-3">
        <span className="truncate font-medium group-data-[collapsible=icon]:hidden">
          Probabilidad y Estadística
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>

          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Home"
                  isActive={pathname === "/"}
                  render={<Link to="/" activeOptions={{ exact: true }} />}
                >
                  <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="About"
                  isActive={pathname === "/about"}
                  render={<Link to="/about" />}
                >
                  <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />
                  <span>About</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Estadísticas Variables Continuas"
                  isActive={pathname === "/estadisticas/variables-continuas"}
                  render={<Link to="/estadisticas/variables-continuas" />}
                >
                  <HugeiconsIcon icon={Chart01Icon} strokeWidth={2} />
                  <span>Estadísticas Variables Continuas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
