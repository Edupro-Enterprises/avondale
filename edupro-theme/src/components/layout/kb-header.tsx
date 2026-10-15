import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { LiveClock } from '@/components/live-clock'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/lib/frappe/auth'
import { primaryRole, ROLE_HOME } from '@/lib/frappe/roles'

/** Header for every /help page -- mirrors DeskHeader (clock/search/theme/
 * profile) plus a way back to whichever role dashboard the signed-in user
 * actually has, since the KB sidebar replaces their normal role nav while
 * they're in here. */
export function KbHeader() {
  const { user } = useCurrentUser()
  const role = user ? primaryRole(user.roles) : null
  const home = role ? ROLE_HOME[role] : null

  return (
    <Header>
      {home && (
        <Button variant='ghost' size='sm' asChild>
          <Link to={home}>
            <ArrowLeft />
            <span className='hidden sm:inline'>Back to dashboard</span>
          </Link>
        </Button>
      )}
      <LiveClock className='hidden md:flex' />
      <Search />
      <div className='ms-auto flex items-center gap-2'>
        <ThemeSwitch />
        <ProfileDropdown />
      </div>
    </Header>
  )
}
