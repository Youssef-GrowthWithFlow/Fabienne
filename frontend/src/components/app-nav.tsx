import {
  CalendarCheck,
  Layers,
  LogOut,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCog,
  Users,
} from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { title: "Aujourd'hui", url: '/', icon: Sun },
  { title: 'Tâches', url: '/taches', icon: CalendarCheck },
  { title: 'Contacts', url: '/contacts', icon: Users },
  { title: 'Trouver des prospects', url: '/recherche', icon: Sparkles },
]

function isActivePath(pathname: string, url: string): boolean {
  return url === '/' ? pathname === '/' : pathname.startsWith(url)
}

function AvatarMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const initial = (user?.full_name || user?.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Réglages"
            className="bg-primary text-primary-foreground hover:opacity-90 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition-opacity"
          />
        }
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {user ? (
          <div className="text-muted-foreground truncate px-2 py-1.5 text-xs">
            {user.email}
          </div>
        ) : null}
        <DropdownMenuItem onClick={() => navigate('/segments')}>
          <Layers className="size-4" />
          Segments
        </DropdownMenuItem>
        {user?.is_admin ? (
          <DropdownMenuItem onClick={() => navigate('/admin/users')}>
            <ShieldCheck className="size-4" />
            Utilisateurs
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => navigate('/compte')}>
          <UserCog className="size-4" />
          Mon compte
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="size-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppNav() {
  const { pathname } = useLocation()

  return (
    <>
      {/* Top header — logo, desktop links, avatar */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2">
            <img
              src="/favicon.png"
              alt="Fabienne"
              width={24}
              height={24}
              className="size-6 shrink-0 rounded"
            />
            <span className="text-sm font-semibold max-sm:hidden">
              Fabienne
            </span>
          </NavLink>

          <nav className="flex flex-1 items-center gap-1 max-sm:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActivePath(pathname, item.url)
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                {item.title}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            <AvatarMenu />
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="bg-background fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.url)
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <item.icon className={cn('size-5', active && 'fill-current')} />
                {item.title === 'Trouver des prospects' ? 'Trouver' : item.title}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}
