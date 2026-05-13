import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">Tableau de bord</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Vue d'ensemble de votre activité.
            </p>
          </div>
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="bg-muted/50 aspect-video rounded-xl" />
            <div className="bg-muted/50 aspect-video rounded-xl" />
            <div className="bg-muted/50 aspect-video rounded-xl" />
          </div>
          <div className="bg-muted/50 min-h-[60vh] flex-1 rounded-xl" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
