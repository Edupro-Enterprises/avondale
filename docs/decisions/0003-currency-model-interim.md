# ADR 0003: Interim currency handling — field added, no conversion engine

## Status

Superseded by [ADR 0004](0004-dual-currency-fx-conversion-engine.md) for the
conversion-engine question. This ADR's interim `currency` fields on `Account`/`Payment
Method` remain the accepted schema; only the "no conversion engine yet" part was interim.

## Context

Commit `73e47be` ("Align specification to ZiG-only setup and finance requirements")
removed the exchange-rate *conversion engine* concept (deleted the exchange-rate feed
import service, the "RBZ Exchange Rate Applied" receipt field, and the
"Applicable Exchange Rate" field) and replaced it with segregated bank
accounts per currency/fee-stream. Despite the commit message, the document still
describes full dual-currency USD/ZiG operation throughout: "Dual-currency financial
processing for USD and ZiG" (Executive Summary), dual-column statement templates, USD
Nostro account references, and an `Exchange Rate` entity still listed in §11.1's data
model — even though the conversion engine that would populate it was removed elsewhere.

The `School Banking Configuration` DocType (added independently, same phase) already
implements the segregated-accounts side of this: each bank account row carries its own
`currency_type` (`ZiG`/`FCA`) and `fee_stream`, with no conversion logic anywhere.

## Decision (interim, Phase 1 only)

Add a `currency` field to `Account` and `Payment Method` (default `ZiG`), matching
`School Banking Configuration`'s existing `currency_type` pattern. Do **not** build any
exchange-rate conversion engine or `Exchange Rate` DocType in Phase 1.

## Consequences

- If the real decision turns out to be dual-currency-via-segregated-accounts (no FX
  conversion), Phase 1's schema needs no rework — just more `Account`/`Payment Method`
  records with `currency = USD`.
- If the real decision is strict ZiG-only, the `currency` field becomes redundant but
  harmless (single fixed value) — cheap to leave in place.
- What Phase 1 explicitly cannot support without further design: automatic FX
  conversion, a live exchange-rate feed, or dual-column statements that convert rather
  than segregate. Confirm which model is intended before the Statutory Financial
  Statements phase is scoped, since the statement templates in the spec assume
  dual-currency presentation.
