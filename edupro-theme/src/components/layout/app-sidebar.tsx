import { useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useSchoolBranding } from '@/lib/frappe/school-setup'
import { sidebarData as bursarSidebarData } from './data/sidebar-data'
import { type SidebarData } from './types'
import { NavGroup, findActiveGroupTitle } from './nav-group'

interface AppSidebarProps {
  data?: SidebarData
}

/** The default Edupro mark is a wide wordmark lockup, wrong for this small
 * square avatar slot -- use the pre-cropped icon-only asset for it, and
 * only switch to the raw upload once the school has actually set one
 * (uploads are asked to be roughly square, so object-contain suits them). */
function SchoolLogoIcon({ className }: { className?: string }) {
  const { data: branding } = useSchoolBranding()
  const src = branding?.school_logo || '/images/favicon-48.png'
  return <img src={src} alt='' className={`${className ?? ''} rounded-sm object-contain`} />
}

/** Renders any role's dense-shell sidebar from its own data set. Defaults
 * to Bursar's for the (many) existing call sites that don't pass one.
 * The school's own uploaded logo + name (from School Setup, via the
 * guest-safe get_school_branding method -- see school-setup.ts) always
 * overrides whatever's in the role's static team entry -- one school
 * identity, shown the same way across every role. */
export function AppSidebar({ data = bursarSidebarData }: AppSidebarProps) {
  const { collapsible, variant } = useLayout()
  const { data: branding } = useSchoolBranding()
  const schoolName = branding?.school_name || data.teams[0]?.name
  const href = useLocation({ select: (location) => location.href })

  // Minimalist menu: only one group's dropdown open at a time, defaulting
  // to whichever group the current page lives in so navigating somewhere
  // doesn't land on a fully-collapsed sidebar.
  const [openGroup, setOpenGroup] = useState<string | null>(() => findActiveGroupTitle(data.navGroups, href))

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className='flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center'>
              <SchoolLogoIcon className='h-8 w-8 shrink-0' />
              <span className='truncate text-sm font-semibold group-data-[collapsible=icon]:hidden'>{schoolName}</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((props) => (
          <NavGroup
            key={props.title}
            {...props}
            isOpen={openGroup === props.title}
            onToggle={() => setOpenGroup((current) => (current === props.title ? null : props.title))}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className='flex items-center justify-center py-2 group-data-[collapsible=icon]:py-1'>
          <img src='/brand/edupro-logo.png' alt='Edupro' className='h-6 w-auto group-data-[collapsible=icon]:hidden' />
          <img src='/images/favicon-48.png' alt='Edupro' className='hidden h-6 w-6 group-data-[collapsible=icon]:block' />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
