import { ConfirmDialog } from '@/components/confirm-dialog'

interface IdleLogoutDialogProps {
  open: boolean
  secondsRemaining: number
  onStayActive: () => void
  onSignOutNow: () => void
}

/** The 60-second warning before useIdleLogout ends the session. Dismissing
 * it any way (the "Stay signed in" button, Escape, or clicking outside)
 * counts as activity and resets the 30-minute timer -- only "Sign out now"
 * ends the session early. */
export function IdleLogoutDialog({ open, secondsRemaining, onStayActive, onSignOutNow }: IdleLogoutDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => { if (!next) onStayActive() }}
      title='Still there?'
      desc={`You'll be signed out in ${secondsRemaining}s due to inactivity.`}
      cancelBtnText='Stay signed in'
      confirmText='Sign out now'
      handleConfirm={onSignOutNow}
      className='sm:max-w-sm'
    />
  )
}
