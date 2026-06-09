import {
  Building2,
  LayoutDashboard,
  Layers,
  LogOut,
  ShieldCheck,
  Telescope,
  UserCog,
  UserSearch,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentProps } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useAuth } from '@/hooks/use-auth'

const navMain: { title: string; url: string; icon: LucideIcon }[] = [
  { title: 'Tableau de bord', url: '/', icon: LayoutDashboard },
  { title: 'Prospects', url: '/prospects', icon: UserSearch },
  { title: 'Entreprises', url: '/entreprises', icon: Building2 },
  { title: 'Sourcer', url: '/sourcer', icon: Telescope },
  { title: 'Segments', url: '/segments', icon: Layers },
]

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex h-8 items-center gap-2 px-2 text-sm font-semibold group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img
            src="/favicon.png"
            alt="Growth With Flow"
            width={20}
            height={20}
            className="size-5 shrink-0 rounded"
          />
          <span className="group-data-[collapsible=icon]:hidden">
            Prospection Automatisée
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => {
                const isActive =
                  item.url !== '#' &&
                  (item.url === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.url))
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={
                        item.url === '#' ? (
                          <a href={item.url} />
                        ) : (
                          <NavLink to={item.url} />
                        )
                      }
                      tooltip={item.title}
                      isActive={isActive}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {user?.is_admin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<NavLink to="/admin/users" />}
                tooltip="Utilisateurs"
                isActive={pathname.startsWith('/admin/users')}
              >
                <ShieldCheck />
                <span>Utilisateurs</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {user && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<NavLink to="/compte" />}
                tooltip="Mon compte"
                isActive={pathname.startsWith('/compte')}
              >
                <UserCog />
                <span className="truncate">{user.email}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              tooltip="Se déconnecter"
            >
              <LogOut />
              <span>Se déconnecter</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
