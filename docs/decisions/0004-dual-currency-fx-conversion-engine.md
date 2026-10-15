# ADR 0004: Dual-currency FX conversion engine — rate-on-row, not precomputed columns

## Status

Accepted — supersedes ADR 0003 for the conversion-engine question. ADR 0003's interim
`currency` fields on `Account`/`Payment Method` stay as-is; this ADR adds the conversion
engine ADR 0003 deferred.

## Context

ADR 0003 shipped Phase 1 with segregated currency-typed accounts (`Account.currency`,
`Payment Method.currency`, both `ZiG`/`USD`) and explicitly no conversion engine, leaving
the real decision open. `school_setup.py::generate_chart_of_accounts()` already creates a
genuinely non-`ZiG` leaf account ("Bank - FCA", `currency: "USD"`), but nothing in
`utils.py`'s Invoice/Receipt → Journal Entry posting path accounts for currency at all —
`create_journal_entry_for_receipt` posts `doc.amount` unchanged on both the (possibly
USD) cash-account debit and the (always ZiG) Debtors credit, implicitly treating 1 USD as
1 ZiG. No production data is affected yet (Phase 2.0 forensics found no Payment Method
records wired to "Bank - FCA"), but the gap is real and was going to surface the moment a
USD Payment Method was configured.

Per the approved Phase 2–9 roadmap, Phase 3 is scoped as foundation only: an `Exchange
Rate` DocType, a `get_exchange_rate()` lookup, and one new field on `Journal Entry
Account` snapshotting the rate used per row — explicitly **not** four precomputed
`debit_usd`/`credit_usd`/`debit_zig`/`credit_zig` columns, to avoid a second surface for
drift between stored and derived values. Fully correcting the receipt-posting math (should
a USD receipt reduce a ZiG invoice's outstanding balance by its ZiG-equivalent, and if so
does that create an FX gain/loss line?) is out of scope here and flagged below as a
follow-up, not silently resolved.

## Decision

- **`Exchange Rate` DocType** (`doctype/exchange_rate/`): `from_currency`/`to_currency`
  (`ZiG`/`USD`), `exchange_rate` (Float, precision 6), `effective_date`, `source` (`RBZ
  Official`/`Bank Advised`/`Manual`), `is_active`, `remarks`. Naming uses a
  `naming_series` (`FX-.YYYY.-.#####`), **not** the plan's originally suggested
  `format:FX-{effective_date}-{from_currency}-{to_currency}` — that format collides on
  any second row for the same pair/date, which directly contradicts this doctype's own
  immutability rule (corrections need a new row, not an edit; see below).
- **Immutability**: once saved, `from_currency`/`to_currency`/`effective_date`/
  `exchange_rate` can never be edited (`exchange_rate.py::_validate_immutable_fields`) —
  only `is_active`/`source`/`remarks` stay editable. A correction is a new row with
  `is_active = 1`, so nothing that already snapshotted an old rate (see below) can be
  silently invalidated. This sidesteps needing to scan every `Journal Entry Account` row
  for references before allowing an edit.
- **`utils.get_exchange_rate(from_currency, to_currency, as_of_date=None)`**: latest
  active rate on or before `as_of_date`, falling back to the inverse of the reverse pair
  if the direct one was never recorded. **Throws** if no rate is resolvable — never
  silently assumes 1:1. Same-currency calls short-circuit to `1.0` with no DB lookup, so
  today's all-`ZiG` production flow is completely unaffected.
- **`utils.convert_amount(amount, from_currency, to_currency, rate=None)`**: for Phase 7
  reporting and the Phase 4+ frontend to derive converted figures on demand, without
  touching the ledger.
- **`Journal Entry Account.exchange_rate`** (Float, precision 6, default 1, read-only):
  the rate from that row's own `Account.currency` into `ZiG` (`utils.BASE_CURRENCY`),
  snapshotted once at creation via `utils._create_journal_entry` and never recalculated.
  Debit/credit values themselves are untouched — still posted in the account's native
  currency, per the roadmap's "rate-on-row, not four columns" instruction.
- **Backfill** (`patches/backfill_journal_entry_fx.py`): sets `exchange_rate = 1` on every
  pre-existing row. Safe unconditionally, not just as a default assumption — every
  account in production before this patch is `ZiG`, so there is no multi-currency
  historical data requiring a judgment call.

## Consequences

- Any Journal Entry line posted against a non-`ZiG` account now requires an active
  `Exchange Rate` for that pair as of the posting date, or the submission is rejected.
  This is new, correct friction — it was previously silently skipped — but means "Bank -
  FCA" (or any other future USD account) cannot be used until at least one `Exchange
  Rate` row exists.
- **Not resolved by this ADR**: `create_journal_entry_for_receipt`'s Dr/Cr amounts are
  still posted at face value with no currency conversion applied to the debit/credit
  themselves — only tagged with the rate that *would* convert them. A USD receipt against
  a ZiG invoice still reduces `Invoice.outstanding_amount` by the raw USD number, not its
  ZiG-equivalent. Fixing this is real design work (does the difference book as FX
  gain/loss, and where), deliberately deferred rather than folded into this foundation
  phase — flag before Phase 6b (heaviest new Journal Entry producer) or Phase 7
  (statements) starts, whichever lands first.
