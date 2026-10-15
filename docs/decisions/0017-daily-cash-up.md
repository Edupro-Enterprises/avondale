# ADR 0017: Daily cash-up, cashier handover, and variance lockout (Phase 1c)

## Status

Accepted.

## Context

The last named Phase 1 item: FR-CSH-01 through FR-CSH-04 (daily reconciliation
of physical cash against the system, cashier handover, automated variance
reporting, and a lockout when a mismatch exceeds a configured threshold)
were entirely unbuilt — no doctype, no report, no lockout of any kind existed
anywhere in the codebase.

## Decisions

**A new `Cash Up` doctype, scoped per cashier per day** — not a single
whole-till document shared across staff, and not folded into the monthly
Bank Reconciliation (a different concern: that's bank-statement-vs-cashbook,
this is till-drawer-vs-system, on a daily cadence, per person). Each line is
one payment method: `system_amount` is computed straight from that cashier's
own submitted Receipts for that date and method
(`SUM(Receipt.amount) WHERE received_by = cashier AND posting_date = date AND
payment_method = method`); `counted_amount` is what they physically counted;
`variance` is the difference. No cross-currency grand total is computed —
lines in different currencies are never summed together, only compared
line-by-line against their own threshold.

**Not a Frappe Workflow doctype.** Unlike Payment Voucher or Bank
Reconciliation, the Draft → Balanced/Variance Flagged transition isn't a
role-gated approval step — it's a data-driven fork (does any line's variance
exceed the threshold?), decided entirely by `submit_cash_up()`'s own
computation, not by who's allowed to click what. Only the *next* step —
`resolve_cash_up()`, clearing a flag — is genuinely role-gated (School Head
only), so that's the one whitelisted method that needs a permission check,
matching the same shape already used for receipt reversal and ED46
certification: the doctype's own DocPerm keeps School Head at read-only, and
the whitelisted method is the sole, deliberately narrow elevation point.

**The threshold is one configurable Currency field on School Setup**
(`cash_up_variance_threshold`, default 5), applied to the absolute value of
each line's own variance in that line's own currency — not a percentage, and
not a single school-wide currency-blind number. Simple, matches how a real
till-variance policy is usually stated ("flag if off by more than $5"), and
lives in the one place this app already keeps school-wide configuration.

**The lockout (FR-CSH-04) is enforced inside `Receipt.validate()`, not as a
DocPerm change.** `cashier_is_locked_out(user)` checks for any `Cash Up` row
where that user is the cashier and the state is still `Variance Flagged`; a
brand-new (non-reversal) Receipt from that user is refused with a clear
message pointing them to the School Head. Reversal receipts are explicitly
exempt from this check — a reversal corrects a past mistake, it doesn't take
new cash, so there's no reason a locked-out cashier shouldn't still be able
to request one (and the School Head reviewing their flagged cash-up may be
the same conversation that surfaces a receipt needing correction).

**A submitted cash-up's counted amounts are locked from further editing**
(mirroring the post-approval-lock pattern already used on Fee Structure) —
once it's left Draft, a cashier can't quietly edit their own counted figures
to make a flag disappear. `handover_to`/`cash_handed_over`/`notes` stay
editable, since those record what happened *after* the count, not the count
itself.

## Consequences

- **No till-level aggregation across multiple cashiers sharing one physical
  drawer.** If two people work the same till in one day, they each submit
  their own cash-up against their own `received_by` receipts — there's no
  concept of "the till" as a single reconciling unit spanning shift changes.
  A school running that way would need one cash-up per shift, not per day,
  which this model already supports (nothing prevents two Cash Up documents
  for the same cashier on the same date if they cash up mid-shift) but
  doesn't name explicitly.
- **Handover is a record, not a workflow.** `handover_to`/`cash_handed_over`
  capture *that* a float was handed over and to whom, but the next shift's
  own cash-up doesn't reference the previous one or verify the opening float
  matches what was handed over — there's no chained opening-balance check.
- **Lockout is binary and immediate, with no escalation tiers.** One flagged
  cash-up locks a cashier out of new receipts entirely until a School Head
  resolves it; there's no "warn on first offense, lock on repeat" policy —
  matching the spec's own plain wording ("lockout if mismatch exceeds
  threshold") rather than inventing a graduated policy nothing asked for.
