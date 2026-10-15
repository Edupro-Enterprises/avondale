# ADR 0005: Internal RBAC — reconciled role list and DocPerm matrix

## Status

Accepted — supersedes ADR 0002's "provisional role set" for the Desk-permission
portion. Portal-facing roles (`Parent/Guardian`, `Student`) are still out of scope here,
per the roadmap's decision to build portal RBAC alongside the real views that exercise it
(Phase 5), not months ahead of them.

## Context

ADR 0002 flagged that the spec contains two disagreeing role matrices (§5.1's 7-persona
"Master Permissions Matrix" vs. a second, differently-named 6-role list) and shipped
Phase 1 with a provisional set (`School Head`, `Bursar`, `Fees Approver`) pending
reconciliation. The approved Phase 2–9 roadmap's Phase 4.3 calls for adding the two
missing internal (Desk-permission-equivalent, though Desk itself is now off-limits — see
ADR 0006) roles from §5.1's matrix and wiring real `DocPerm` rows for all five internal
roles across the DocTypes that exist today.

## Decision

**Reconciliation**: treat §5.1's "Master Permissions Matrix" as canonical (it's the one
still present and consistent in the current spec revision). `System Administrator` maps
to Frappe's built-in `System Manager` — no separate role. `Fees Approver` (Phase 1) stays
as the concrete implementation of the matrix's Fee Structure approval step and is not
renamed or merged with `Bursar`, since it's already wired into the live Fee Structure
Workflow fixture. Two new roles, matching the matrix's exact names:

- **`SDC Chairperson/Treasurer`**
- **`District Education Auditor/Inspector`**

Created via `patches/create_extended_roles.py`, both `desk_access = 0`.

**DocPerm matrix** — added across the 12 non-table DocTypes where §5.1's matrix maps to
something that actually exists today (`Account`, `Audit Log`, `Beneficiary Category`,
`Exchange Rate`, `Fee Item`, `Fee Structure`, `Invoice`, `Journal Entry`, `Parent
Guardian`, `Payment Method`, `Receipt`, `Student`):

| Role | Pattern |
|---|---|
| `School Head` | `read: 1` on all 12 (matrix: "Full" visibility everywhere except direct cashiering) plus `write: 1` on `Fee Structure` only (matrix: "Co-Sign" on approval) |
| `SDC Chairperson/Treasurer` | `read: 1` + `write: 1` on `Fee Structure` (co-sign), `read: 1` on `Account`/`Exchange Rate`/`Journal Entry` (matrix: "Read (SDC)" on the GL). **Not** granted on `Student`/`Invoice`/`Receipt`/`Parent Guardian` — the matrix's "View Student Balance & Statement" row is explicitly "No" for this role, read literally rather than reconciled against the looser prose in §5.2.3 ("strictly read-only access to individual learner records"), since the matrix is the more precise source |
| `District Education Auditor/Inspector` | `read: 1` only, on all 12 — never `write`/`create`/`delete` anywhere, matching §5.2.7's "cannot add, modify, delete, or reverse any system record" literally |

`Beneficiary Category`/`Fee Item`/`Parent Guardian`/`Payment Method` get `School Head`
read access only (not SDC/Auditor) — these are operational configuration/reference data
outside both roles' described audit or oversight mandate. Not touched:
`Academic Year`/`District`/`Province`/`Region`/`School Setup`/`Term` (already carry
`School Head` rows from earlier work, and adding the two new roles to pure
geographic/calendar reference data is out of this phase's scope) and the four child-table
DocTypes (`Fee Structure Item`, `Invoice Line`, `Journal Entry Account`, `School Banking
Configuration`), whose access already follows their parent document.

## Consequences

- **Fund-scoping is not enforced yet.** The matrix's "Read (SDC)" annotation on GL access
  implies `SDC Chairperson/Treasurer` should see only Fund B (SDC/SDA) transactions, not
  Fund A (Government). `Account.fund` already exists as a field, but row-level filtering
  needs a `permission_query_conditions` hook — deliberately deferred rather than guessed
  at here, for the same reason portal RBAC was pushed to Phase 5: don't build
  permission-scoping logic before there's a real view to test it against. Until a
  `permission_query_conditions` hook lands, `SDC Chairperson/Treasurer` can technically
  read Fund A accounts/entries through the API despite the spec's intent — flag before
  this role is actually handed to a real user.
- Workflow-level enforcement (which roles can transition a Fee Structure through
  `Draft → Pending Approval → Approved`) is a separate mechanism
  (`workflow/fee_structure_workflow.json`'s own allowed-roles per transition) from the
  `DocPerm write: 1` granted here. Granting `write: 1` to `School Head`/`SDC
  Chairperson/Treasurer` makes the co-sign *possible* at the DocPerm layer; the workflow
  fixture itself was not modified in this phase and still needs to name these roles as
  permitted transitioners for "Co-Sign" to work end-to-end. Flag before Fee Structure
  approval is exercised by anyone other than `Fees Approver`.
- Permissions not addressed at all in this phase (no DocType exists yet to attach them
  to): Payment Voucher authorization, Journal Reversal authorization, MoPSE ED46
  generation — all Phase 6/7 work.
