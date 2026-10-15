import { Link } from '@tanstack/react-router'
import useDialogState from '@/hooks/use-dialog-state'
import { useCurrentUser } from '@/lib/frappe/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

interface ProfileDropdownProps {
  settingsPath?: string
  /** Overrides -- PortalLayout (Student/Parent) already derives these from
   * its own useCurrentUser() call for other purposes (page greeting, etc.)
   * and passes them through rather than duplicating that fetch. The
   * Desk-shell headers (Bursar/School Head/SDC/System Admin) pass none of
   * these, so this reads the real logged-in user itself -- previously they
   * defaulted to a hardcoded fake persona, showing the same made-up name/
   * email regardless of who was actually signed in. */
  name?: string
  email?: string
  avatarFallback?: string
}

export function ProfileDropdown({ settingsPath = '/settings', name: nameProp, email: emailProp, avatarFallback: avatarProp }: ProfileDropdownProps) {
  const [open, setOpen] = useDialogState()
  const { user } = useCurrentUser()
  const name = nameProp ?? user?.full_name ?? 'Loading…'
  const email = emailProp ?? user?.name ?? ''
  const avatarFallback = avatarProp ?? (user ? initialsOf(user.full_name) : '…')

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src='/avatars/01.png' alt={name} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>{name}</p>
              <p className='text-xs leading-none text-muted-foreground'>
                {email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to={settingsPath}>
                Settings
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            Sign out
            <DropdownMenuShortcut className='text-current'>
              ⇧⌘Q
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
