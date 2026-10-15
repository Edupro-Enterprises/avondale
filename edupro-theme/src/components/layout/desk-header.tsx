import { Header } from '@/components/layout/header'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { LiveClock } from '@/components/live-clock'
import { HelpLink } from '@/components/layout/help-link'

/** Shared header for every dense-shell (Desk-style) role -- Bursar, School
 * Head, SDC, System Admin. The sidebar already carries full navigation, so
 * this is just the global search/theme/profile controls; ProfileDropdown
 * reads the real logged-in user itself. */
export function DeskHeader() {
  return (
    <Header>
      <LiveClock className='hidden md:flex' />
      <Search />
      <div className='ms-auto flex items-center gap-2'>
        <HelpLink />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </div>
    </Header>
  )
}
