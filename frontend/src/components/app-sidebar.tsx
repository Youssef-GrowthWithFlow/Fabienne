import {
  LayoutDashboard,
  Layers,
  UserSearch,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentProps } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

const navMain: { title: string; url: string; icon: LucideIcon }[] = [
  { title: 'Tableau de bord', url: '/', icon: LayoutDashboard },
  { title: 'Prospects', url: '/prospects', icon: UserSearch },
  { title: 'Segments', url: '/segments', icon: Layers },
]

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex h-8 items-center px-2 text-sm font-semibold group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="group-data-[collapsible=icon]:hidden">Fabienne</span>
          <span className="hidden group-data-[collapsible=icon]:inline">F</span>
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

      <SidebarRail />
    </Sidebar>
  )
}
