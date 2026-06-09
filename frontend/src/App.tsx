import { Loader2 } from 'lucide-react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ActionsProvider } from '@/hooks/use-actions'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { EntreprisesProvider } from '@/hooks/use-entreprises'
import { ProspectsProvider } from '@/hooks/use-prospects'
import { SegmentsProvider } from '@/hooks/use-segments'
import { SourcerProvider } from '@/hooks/use-sourcer-history'
import { Account } from '@/pages/Account'
import { AdminUsers } from '@/pages/AdminUsers'
import { Dashboard } from '@/pages/Dashboard'
import { Entreprises } from '@/pages/Entreprises'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { Login } from '@/pages/Login'
import { Prospects } from '@/pages/Prospects'
import { ResetPassword } from '@/pages/ResetPassword'
import { Segments } from '@/pages/Segments'
import { Sourcer } from '@/pages/Sourcer'

function pageTitleFor(pathname: string): string {
  if (pathname === '/') return 'Tableau de bord'
  if (pathname.startsWith('/prospects')) return 'Prospects'
  if (pathname.startsWith('/entreprises')) return 'Entreprises'
  if (pathname.startsWith('/sourcer')) return 'Sourcer'
  if (pathname.startsWith('/segments')) return 'Segments'
  if (pathname.startsWith('/admin/users')) return 'Utilisateurs'
  return 'Tableau de bord'
}

function App() {
  // Password-reset / forgot-password pages are reachable without auth.
  const { pathname } = useLocation()
  if (pathname === '/reset-password') return <ResetPassword />
  if (pathname === '/forgot-password') return <ForgotPassword />

  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  )
}

function AuthedApp() {
  const { status } = useAuth()

  if (status === 'initializing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Login />
  }

  return <AppShell />
}

function AppShell() {
  const { pathname } = useLocation()

  return (
    <ActionsProvider>
      <SegmentsProvider>
        <EntreprisesProvider>
          <ProspectsProvider>
            <SourcerProvider>
              <TooltipProvider>
                <SidebarProvider>
                  <AppSidebar />
                  <SidebarInset className="min-w-0 overflow-x-hidden">
                    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                      <SidebarTrigger className="-ml-1" />
                      <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                      />
                      <h1 className="text-base font-medium">
                        {pageTitleFor(pathname)}
                      </h1>
                    </header>
                    <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/prospects" element={<Prospects />} />
                        <Route path="/entreprises" element={<Entreprises />} />
                        <Route path="/sourcer" element={<Sourcer />} />
                        <Route path="/segments" element={<Segments />} />
                        <Route path="/admin/users" element={<AdminUsers />} />
                        <Route path="/compte" element={<Account />} />
                      </Routes>
                    </div>
                  </SidebarInset>
                </SidebarProvider>
              </TooltipProvider>
            </SourcerProvider>
          </ProspectsProvider>
        </EntreprisesProvider>
      </SegmentsProvider>
    </ActionsProvider>
  )
}

export default App
