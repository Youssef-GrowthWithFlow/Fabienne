import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentProps } from 'react'

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
  { title: 'Tableau de bord', url: '#', icon: LayoutDashboard },
  { title: 'Clients', url: '#', icon: Users },
  { title: 'Rapports', url: '#', icon: BarChart3 },
  { title: 'Documents', url: '#', icon: FileText },
]

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
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
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<a href={item.url} />}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
