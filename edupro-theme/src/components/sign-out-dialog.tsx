import { useNavigate, useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { logout } from '@/lib/frappe/auth'
import { useAuthStore } from '@/stores/auth-store'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { auth } = useAuthStore()

  const handleSignOut = async () => {
    // The real Frappe session cookie, not just this app's own local state --
    // without this call the session stayed valid server-side no matter what
    // the UI showed (confirmed: this dialog never actually invalidated it).
    try {
      await logout()
    } catch {
      // Already invalid/expired server-side -- still clear local state below.
    }
    auth.reset()
    queryClient.clear()
    const currentPath = location.href
    navigate({
      to: '/sign-in',
      search: { redirect: currentPath },
      replace: true,
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Sign out'
      desc='Are you sure you want to sign out? You will need to sign in again to access your account.'
      confirmText='Sign out'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
