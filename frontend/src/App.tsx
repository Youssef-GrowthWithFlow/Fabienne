import { Loader2 } from 'lucide-react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { AppNav } from '@/components/app-nav'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { EntreprisesProvider } from '@/hooks/use-entreprises'
import { ProspectsProvider } from '@/hooks/use-prospects'
import { SegmentsProvider } from '@/hooks/use-segments'
import { SourcerProvider } from '@/hooks/use-sourcer-history'
import { Account } from '@/pages/Account'
import { AdminUsers } from '@/pages/AdminUsers'
import { Aujourdhui } from '@/pages/Aujourdhui'
import { Contacts } from '@/pages/Contacts'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { Recherche } from '@/pages/Recherche'
import { Login } from '@/pages/Login'
import { ResetPassword } from '@/pages/ResetPassword'
import { Segments } from '@/pages/Segments'
import { Taches } from '@/pages/Taches'

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
  return (
    <SegmentsProvider>
      <EntreprisesProvider>
        <ProspectsProvider>
          <SourcerProvider>
            <TooltipProvider>
              <div className="flex min-h-screen flex-col">
                <AppNav />
                <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 sm:px-6 sm:pb-10">
                  <Routes>
                    <Route path="/" element={<Aujourdhui />} />
                    <Route path="/taches" element={<Taches />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/recherche" element={<Recherche />} />
                    <Route path="/segments" element={<Segments />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/compte" element={<Account />} />
                  </Routes>
                </main>
              </div>
            </TooltipProvider>
          </SourcerProvider>
        </ProspectsProvider>
      </EntreprisesProvider>
    </SegmentsProvider>
  )
}

export default App
