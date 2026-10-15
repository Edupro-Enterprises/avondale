/** Exchange Rate doctype access -- see the backend repo's
 * edupro_school_fees/doctype/exchange_rate/exchange_rate.json and
 * utils.py::get_exchange_rate, which this mirrors on the frontend: the
 * latest active USD->ZiG rate on or before today (exchange_rate = ZiG per 1
 * USD, e.g. 27 -- matches how the school actually quotes it, "$1 = 27 ZiG"),
 * falling back to the inverse of an active ZiG->USD rate. Replaces the old
 * localStorage-only useExchangeRateStore, which let two browsers silently
 * disagree on "the" rate with no audit trail -- rates are now real,
 * timestamped records any Bursar/School Head/SDC/Auditor can see the
 * history of.
 *
 * Direction matters here: get_exchange_rate(from, to) treats its stored
 * `exchange_rate` as "how many `to` per 1 `from`". Storing the rate as
 * USD->ZiG (direct hit for the ledger's own USD-account conversions, which
 * call get_exchange_rate(account_currency, "ZiG")) means no inversion round
 * trip is needed for the case that actually matters for GL postings. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'

export interface FrappeExchangeRate {
  name: string
  from_currency: 'ZiG' | 'USD'
  to_currency: 'ZiG' | 'USD'
  exchange_rate: number
  effective_date: string
  source: 'RBZ Official' | 'Bank Advised' | 'Manual'
  is_active: 0 | 1
  remarks?: string
}

const DEFAULT_ZIG_PER_USD = 27
const todayIso = () => new Date().toISOString().slice(0, 10)

async function latestActiveRate(from: string, to: string): Promise<number | null> {
  const res = await listResource<Pick<FrappeExchangeRate, 'exchange_rate'>>('Exchange Rate', {
    filters: JSON.stringify([
      ['from_currency', '=', from],
      ['to_currency', '=', to],
      ['is_active', '=', 1],
      ['effective_date', '<=', todayIso()],
    ]),
    fields: JSON.stringify(['exchange_rate']),
    order_by: 'effective_date desc',
    limit_page_length: '1',
  })
  return res.data[0]?.exchange_rate ?? null
}

/** The current ZiG-per-USD rate everywhere a ZiG amount needs a USD
 * equivalent. Falls back to a fixed default only if no Exchange Rate has
 * ever been recorded, so a fresh install isn't left with no rate at all. */
export function useCurrentZigPerUsd() {
  return useQuery({
    queryKey: ['exchange-rate', 'current'],
    queryFn: async () => {
      const direct = await latestActiveRate('USD', 'ZiG')
      if (direct) return direct
      const inverse = await latestActiveRate('ZiG', 'USD')
      if (inverse) return 1 / inverse
      return DEFAULT_ZIG_PER_USD
    },
    staleTime: 60 * 1000,
  })
}

/** Records a new active USD->ZiG rate effective today (rate = ZiG per 1 USD)
 * -- Bursar/System Manager only, per Exchange Rate's own DocPerm. Existing
 * rates are never edited or deactivated here (this doctype is an audit
 * trail of what rate was in force when), matching how the backend itself
 * always looks up the latest by effective_date rather than mutating a
 * single row. */
export function useSetTodayExchangeRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rate: number) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Exchange Rate', {
        from_currency: 'USD',
        to_currency: 'ZiG',
        exchange_rate: rate,
        effective_date: todayIso(),
        source: 'Manual',
        is_active: 1,
      })
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exchange-rate'] }),
  })
}
