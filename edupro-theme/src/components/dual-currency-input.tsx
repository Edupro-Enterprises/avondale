import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { Money } from '@/components/money'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'

type Currency = 'USD' | 'ZiG'

interface DualCurrencyInputProps {
  amount: string
  onAmountChange: (v: string) => void
  currency: Currency
  onCurrencyChange: (v: Currency) => void
  label?: string
  required?: boolean
  error?: string
  compact?: boolean
}

/** Currency-select + amount input with a live USD-equivalent preview when
 * ZiG is entered, against the single admin-set exchange rate. USD is
 * always the default; ZiG is a per-transaction choice, not a global
 * display toggle -- once submitted, the computed USD-equivalent is what
 * gets stored (see the store's own doc comment on why that's locked, not
 * re-computed later). */
export function DualCurrencyInput({
  amount,
  onAmountChange,
  currency,
  onCurrencyChange,
  label = 'Amount',
  required,
  error,
  compact = true,
}: DualCurrencyInputProps) {
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const amountUSD = currency === 'ZiG' && amount ? zigToUsd(Number(amount), zigPerUsd) : Number(amount || 0)
  const controlClass = compact ? compactControlClass : undefined

  return (
    <div className='grid grid-cols-2 gap-3'>
      <CompactField label='Currency'>
        <Select value={currency} onValueChange={(v) => onCurrencyChange(v as Currency)}>
          <SelectTrigger className={controlClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='USD'>USD</SelectItem>
            <SelectItem value='ZiG'>ZiG</SelectItem>
          </SelectContent>
        </Select>
      </CompactField>
      <CompactField label={`${label} (${currency})`} required={required} error={error}>
        <Input
          type='number'
          className={controlClass}
          placeholder={currency === 'USD' ? '375' : '10125'}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          aria-invalid={!!error}
        />
      </CompactField>
      {currency === 'ZiG' && amount && !error && (
        <p className='col-span-2 text-[11px] text-muted-foreground'>
          ≈ <Money usd={amountUSD} /> at ZiG {zigPerUsd} / USD
        </p>
      )}
    </div>
  )
}
