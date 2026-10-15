/** The whole system runs on Zimbabwe time regardless of the viewer's own
 * device/browser timezone (a diaspora parent checking the portal from
 * abroad should still see school time, not their own) -- every date/time
 * display goes through this, never a bare `Date`/`toLocaleString()` call
 * that would silently use the browser's local zone instead.
 *
 * Africa/Harare is UTC+2 year-round (no DST), so this is safe to treat as
 * a fixed offset, but using Intl's `timeZone` option (rather than manually
 * adding 2 hours) keeps this correct automatically if that ever changes. */
export const APP_TIME_ZONE = 'Africa/Harare'

const CLOCK_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** "Monday, 29 September 2026, 14:30" */
export function formatHarareClock(date: Date): string {
  return CLOCK_FORMATTER.format(date)
}

const PARTS_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export interface HarareClockParts {
  weekday: string
  date: string // "29 September 2026"
  time: string // "14:30:05"
}

/** Same clock, split into pieces so the terminal-style display can colour
 * the weekday/date/time segments independently instead of one flat string. */
export function formatHarareClockParts(date: Date): HarareClockParts {
  const parts = PARTS_FORMATTER.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    weekday: get('weekday'),
    date: `${get('day')} ${get('month')} ${get('year')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  }
}
