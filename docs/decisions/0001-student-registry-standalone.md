# ADR 0001: Standalone student registry, no live sync to Edupro SMS

## Status

Accepted (2026-09-09).

## Context

The existing Edupro SMS Frappe app (github.com/ttshava/edupro-sms) already holds
Edupro's own school's student, guardian, and bursar/fees records at
`erp.edupro.co.zw`. The spec for this system (`technical-functional-specification.md`)
never states whether its `Student`/`Parent Guardian` records are the same records
already managed by Edupro SMS, or a separate registry.

## Decision

This system is a **separate, rigorous system** (project decision, 2026-09-09) with its
own `Student` and `Parent Guardian` DocTypes, self-contained. There is **no** live sync
or shared database with `erp.edupro.co.zw` in Phase 1 or any currently-planned phase.

## Consequences

- Student/guardian data will need to be entered or migrated into this system
  independently of Edupro SMS — this is a known duplication, not an oversight.
- A future integration (one-way sync, shared identity, or a full migration off Edupro
  SMS's bursar module for Edupro's own school) is possible but explicitly out of scope
  until decided separately. Track it as a future ADR if/when it becomes a real
  requirement.
