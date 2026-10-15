import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { sidebarData as bursarSidebarData } from '@/components/layout/data/sidebar-data'
import { type SidebarData } from '@/components/layout/types'
import { SkipToMain } from '@/components/skip-to-main'
import { IdleLogoutDialog } from '@/components/idle-logout-dialog'
import { useIdleLogout } from '@/hooks/use-idle-logout'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
  sidebarData?: SidebarData
}

export function AuthenticatedLayout({ children, sidebarData = bursarSidebarData }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const idleLogout = useIdleLogout()
  return (
    <SearchProvider sidebarData={sidebarData}>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar data={sidebarData} />
          <IdleLogoutDialog
            open={idleLogout.warningOpen}
            secondsRemaining={idleLogout.secondsRemaining}
            onStayActive={idleLogout.stayActive}
            onSignOutNow={idleLogout.signOutNow}
          />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-data-[layout=fixed]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
