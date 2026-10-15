import { Outlet } from '@tanstack/react-router'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { PortalNav, type PortalNavLink } from '@/components/layout/portal-nav'
import { SkipToMain } from '@/components/skip-to-main'
import { LiveClock } from '@/components/live-clock'
import { IdleLogoutDialog } from '@/components/idle-logout-dialog'
import { useIdleLogout } from '@/hooks/use-idle-logout'
import { useSchoolBranding } from '@/lib/frappe/school-setup'
import { HelpLink } from '@/components/layout/help-link'

interface PortalLayoutProps {
  tagline: string
  navLinks: PortalNavLink[]
  userName: string
  userEmail: string
  avatarFallback: string
  settingsPath: string
}

/** A lightweight portal shell -- a narrow, centered column with a simple
 * sticky header and a flat nav bar, deliberately not AuthenticatedLayout's
 * dense admin sidebar. Shared by Parent and Student, each supplying their
 * own tagline/nav/persona. */
export function PortalLayout({ tagline, navLinks, userName, userEmail, avatarFallback, settingsPath }: PortalLayoutProps) {
  const { data: branding } = useSchoolBranding()
  const logoUrl = branding?.school_logo || '/brand/edupro-logo.png'
  const schoolName = branding?.school_name || 'Edupro SMS'
  const idleLogout = useIdleLogout()

  return (
    <div className='min-h-svh bg-background'>
      <SkipToMain />
      <header className='sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60'>
        <div className='mx-auto flex justify-center border-b py-1'>
          <LiveClock className='text-xs' />
        </div>
        <div className='mx-auto flex h-14 max-w-2xl items-center gap-3 px-4'>
          <img src={logoUrl} alt={schoolName} className='h-7 w-auto' />
          <div className='leading-tight'>
            <p className='text-xs font-semibold'>{schoolName}</p>
            <p className='text-[10px] text-muted-foreground'>{tagline}</p>
          </div>
          <div className='ms-auto flex items-center gap-2'>
            <HelpLink />
            <ThemeSwitch />
            <ProfileDropdown
              name={userName}
              email={userEmail}
              avatarFallback={avatarFallback}
              settingsPath={settingsPath}
            />
          </div>
        </div>
      </header>

      <PortalNav links={navLinks} />

      <main id='content' className='mx-auto max-w-2xl px-4 py-6'>
        <Outlet />
      </main>

      <IdleLogoutDialog
        open={idleLogout.warningOpen}
        secondsRemaining={idleLogout.secondsRemaining}
        onStayActive={idleLogout.stayActive}
        onSignOutNow={idleLogout.signOutNow}
      />
    </div>
  )
}
