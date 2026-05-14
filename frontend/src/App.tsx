import { Route, Routes, useLocation } from 'react-router-dom'

import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ProspectsProvider } from '@/hooks/use-prospects'
import { SegmentsProvider } from '@/hooks/use-segments'
import { Dashboard } from '@/pages/Dashboard'
import { Prospects } from '@/pages/Prospects'
import { Segments } from '@/pages/Segments'

function pageTitleFor(pathname: string): string {
  if (pathname === '/') return 'Tableau de bord'
  if (pathname.startsWith('/prospects')) return 'Prospects'
  if (pathname.startsWith('/segments')) return 'Segments'
  return 'Tableau de bord'
}

function App() {
  const { pathname } = useLocation()

  return (
    <ProspectsProvider>
      <SegmentsProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0 overflow-x-hidden">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <h1 className="text-base font-medium">{pageTitleFor(pathname)}</h1>
            </header>
            <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/prospects" element={<Prospects />} />
                <Route path="/segments" element={<Segments />} />
              </Routes>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </SegmentsProvider>
    </ProspectsProvider>
  )
}

export default App
