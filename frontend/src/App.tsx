import { Route, Routes, useLocation } from 'react-router-dom'

import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Dashboard } from '@/pages/Dashboard'
import { Prospects } from '@/pages/Prospects'

const pageTitles: Record<string, string> = {
  '/': 'Tableau de bord',
  '/prospects': 'Prospects',
}

function App() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'Tableau de bord'

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">{title}</h1>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prospects" element={<Prospects />} />
          </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
