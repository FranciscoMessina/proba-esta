import { useEffect, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import {
  ArrowDown01Icon,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

const ESTADISTICAS_PREFIX = "/estadisticas"

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const estadisticasActive = pathname.startsWith(ESTADISTICAS_PREFIX)
  const [estadisticasOpen, setEstadisticasOpen] = useState(estadisticasActive)

  useEffect(() => {
    if (estadisticasActive) {
      setEstadisticasOpen(true)
    }
  }, [estadisticasActive])

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
                  type="button"
                  tooltip="Estadísticas"
                  isActive={estadisticasActive}
                  onClick={() => setEstadisticasOpen((open) => !open)}
                  aria-expanded={estadisticasOpen}
                >
                  <HugeiconsIcon icon={Chart01Icon} strokeWidth={2} />
                  <span>Estadísticas</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    strokeWidth={2}
                    className={cn(
                      "ml-auto shrink-0 transition-transform group-data-[collapsible=icon]:hidden",
                      estadisticasOpen && "rotate-180",
                    )}
                  />
                </SidebarMenuButton>
                {estadisticasOpen ? (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={
                          pathname === "/estadisticas/variables-discretas"
                        }
                        render={
                          <Link to="/estadisticas/variables-discretas" />
                        }
                      >
                        <span>Variables discretas</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={
                          pathname ===
                          "/estadisticas/variables-discretas-agrupadas"
                        }
                        render={
                          <Link to="/estadisticas/variables-discretas-agrupadas" />
                        }
                      >
                        <span>Variables discretas agrupadas</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={
                          pathname === "/estadisticas/variables-continuas"
                        }
                        render={
                          <Link to="/estadisticas/variables-continuas" />
                        }
                      >
                        <span>Variables continuas</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
