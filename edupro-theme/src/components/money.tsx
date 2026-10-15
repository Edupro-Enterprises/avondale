import { cn } from '@/lib/utils'
import { formatUSD, formatUSDCompact } from '@/lib/currency'

interface MoneyProps {
  usd: number
  compact?: boolean
  className?: string
}

/** Renders a USD money figure -- the single format every place money
 * appears in Edupro Theme should use. `compact` abbreviates the figure
 * ($480k) for dense list rows. */
export function Money({ usd, compact, className }: MoneyProps) {
  const primary = compact ? formatUSDCompact(usd) : formatUSD(usd)

  return <span className={cn('font-semibold tabular-nums', className)}>{primary}</span>
}
