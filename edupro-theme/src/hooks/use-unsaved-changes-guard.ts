import { useState } from 'react'

/** Shared unsaved-changes guard (AUD-031): wire a dialog's onOpenChange
 * through `handleOpenChange` and pass `isDirty` from the form's own dirty
 * state. Closing while dirty asks first instead of silently discarding.
 * Render `<ConfirmDialog {...guard.discardDialogProps} />` (from
 * '@/components/confirm-dialog', the same component every other
 * destructive confirmation in the app uses) alongside the form dialog. */
export function useUnsavedChangesGuard(isDirty: boolean, onClose: () => void) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleOpenChange(open: boolean) {
    if (open) return
    if (isDirty) {
      setConfirmOpen(true)
    } else {
      onClose()
    }
  }

  function confirmDiscard() {
    setConfirmOpen(false)
    onClose()
  }

  const discardDialogProps = {
    open: confirmOpen,
    onOpenChange: setConfirmOpen,
    title: 'Discard unsaved changes?',
    desc: "You'll lose what you've entered so far.",
    confirmText: 'Discard',
    destructive: true,
    handleConfirm: confirmDiscard,
    className: 'sm:max-w-sm',
  }

  return { handleOpenChange, discardDialogProps }
}
