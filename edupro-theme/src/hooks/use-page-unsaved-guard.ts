import { useBlocker } from '@tanstack/react-router'

/** Page-level unsaved-changes guard (AUD-046) -- the full-page equivalent
 * of useUnsavedChangesGuard, for standalone forms like Institution Profile
 * that aren't dialogs. Blocks in-app navigation away and warns on tab
 * close/refresh while `isDirty`. Render
 * `<ConfirmDialog {...guard.discardDialogProps} />` alongside the page. */
export function usePageUnsavedGuard(isDirty: boolean) {
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  })

  const discardDialogProps = {
    open: blocker.status === 'blocked',
    onOpenChange: (open: boolean) => {
      if (!open) blocker.reset?.()
    },
    title: 'Discard unsaved changes?',
    desc: "You'll lose what you've entered so far.",
    confirmText: 'Discard',
    destructive: true,
    handleConfirm: () => blocker.proceed?.(),
    className: 'sm:max-w-sm',
  }

  return { discardDialogProps }
}
