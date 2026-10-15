/**
 * Money formatting for Edupro Theme. USD is the primary currency shown to
 * users -- confirmed product decision -- and every list, dashboard, and
 * report displays a USD figure. This is a display/functional-currency
 * choice, distinct from the backend's internal ledger/bookkeeping currency:
 * edupro_school_fees/utils.py::BASE_CURRENCY is ZiG, and every GL/report
 * total is computed in ZiG first, with the USD figure shown here converted
 * from it -- the same functional-vs-ledger-currency split many businesses
 * in high-inflation economies use, not a contradiction to resolve. ZiG is
 * directly selectable per-transaction only where a real currency choice
 * exists (Receipts, Petty Cash), against the current rate from
 * lib/frappe/exchange-rates.ts (a real, audited Exchange Rate record --
 * not a local-only admin setting). Every place money appears should go
 * through these helpers so formatting can't drift page-to-page.
 */

export function formatUSD(amountUSD: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountUSD)
}

/** Abbreviated USD for dense list views, e.g. $480k, $6.84M -- mirrors the
 * abbreviation convention already used elsewhere in this app's list rows. */
export function formatUSDCompact(amountUSD: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amountUSD)
}

export function formatZiG(amountZiG: number): string {
  return `ZiG ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountZiG)}`
}

/** Convert a ZiG amount to its USD equivalent at the given rate (ZiG per
 * USD) -- pass the current useCurrentZigPerUsd() rate for a live preview
 * before submitting a new transaction, or whatever rate was active when a
 * transaction was recorded to explain its already-locked amountUSD. */
export function zigToUsd(amountZiG: number, zigPerUsd: number): number {
  return amountZiG / zigPerUsd
}

/** Convert a USD amount to its ZiG equivalent at the given rate (ZiG per
 * USD) -- the reverse of zigToUsd, for converting a ZiG-denominated
 * payment against a USD-denominated invoice line (or vice versa) so both
 * sides of an allocation comparison are in the same currency. */
export function usdToZig(amountUsd: number, zigPerUsd: number): number {
  return amountUsd * zigPerUsd
}
