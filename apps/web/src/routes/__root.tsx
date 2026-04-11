import { Outlet, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

import { AppSidebar } from "@/components/app-sidebar.tsx"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex  py-2 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
      
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <Outlet />
        </div>
      </SidebarInset>
      {import.meta.env.DEV ? (
        <TanStackRouterDevtools position="bottom-right" />
      ) : null}
    </SidebarProvider>
  )
}
