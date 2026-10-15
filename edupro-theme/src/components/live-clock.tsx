import { useEffect, useState } from 'react'
import { formatHarareClockParts } from '@/lib/datetime'

/** A little terminal-prompt-styled clock -- always dark, regardless of the
 * app's own light/dark theme (a terminal is its own visual identity, not
 * something that should flip with the rest of the UI). Ticks every second
 * so the seconds field genuinely animates, matching a real terminal clock. */
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { weekday, date, time } = formatHarareClockParts(now)

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-neutral-950 px-2.5 py-1 font-mono text-[11px] leading-none whitespace-nowrap shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] ${className ?? ''}`}
    >
      <span className='text-emerald-400'>❯</span>
      <span className='text-cyan-400'>{weekday}</span>
      <span className='text-neutral-600'>·</span>
      <span className='text-amber-400'>{date}</span>
      <span className='text-neutral-600'>·</span>
      <span className='text-fuchsia-400 tabular-nums'>{time}</span>
      <span className='ml-0.5 h-3 w-[6px] animate-pulse bg-emerald-400' aria-hidden='true' />
    </span>
  )
}
