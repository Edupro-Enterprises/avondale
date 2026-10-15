import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { logout } from '@/lib/frappe/auth'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const WARNING_MS = 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const

/** Ends the real Frappe session (not just a client-side redirect) after 30
 * minutes with no mouse/keyboard/touch/scroll activity anywhere on the
 * page, warning the user for the last 60 seconds so mid-task work isn't
 * silently lost. One instance mounted per shell (AuthenticatedLayout,
 * PortalLayout) covers every page under it -- activity listeners are on
 * `window`, not per-route. */
export function useIdleLogout() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const [warningOpen, setWarningOpen] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_MS / 1000)
  // 0 until the mount effect below sets a real timestamp -- Date.now() is an
  // impure call, so it can't run during render (React's purity rule).
  const lastActivityRef = useRef(0)
  const loggingOutRef = useRef(false)

  const signOutNow = useCallback(() => {
    if (loggingOutRef.current) return
    loggingOutRef.current = true
    const redirectTo = location.href
    logout()
      .catch(() => {
        // The session may already be invalid server-side (e.g. it expired
        // independently) -- still clear local state and redirect either way.
      })
      .finally(() => {
        queryClient.clear()
        navigate({ to: '/sign-in', search: { redirect: redirectTo }, replace: true })
      })
  }, [location.href, navigate, queryClient])

  const stayActive = useCallback(() => {
    lastActivityRef.current = Date.now()
    setWarningOpen(false)
  }, [])

  // Mount-only: seeds the idle clock once. Deliberately not merged into the
  // effect below -- that one re-subscribes whenever `warningOpen` changes,
  // and resetting the timestamp on every such re-run would mean the
  // countdown never actually reaches zero while the dialog is open.
  useEffect(() => {
    lastActivityRef.current = Date.now()
  }, [])

  useEffect(() => {
    const handleActivity = () => {
      // While the warning dialog is up, only an explicit "stay signed in"
      // click (stayActive, called separately) resets the timer -- ignoring
      // background mouse/scroll noise here means the countdown some other
      // browser tab or a stray cursor twitch can't silently cancel it.
      if (warningOpen) return
      lastActivityRef.current = Date.now()
    }
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true })
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity)
      }
    }
  }, [warningOpen])

  useEffect(() => {
    const id = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current
      if (idleFor >= IDLE_TIMEOUT_MS) {
        signOutNow()
        return
      }
      if (idleFor >= IDLE_TIMEOUT_MS - WARNING_MS) {
        setWarningOpen(true)
        setSecondsRemaining(Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - idleFor) / 1000)))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [signOutNow])

  return { warningOpen, secondsRemaining, stayActive, signOutNow }
}
