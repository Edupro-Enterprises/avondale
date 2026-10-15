# ADR 0002: Provisional Phase 1 role set pending RBAC reconciliation

## Status

Superseded by [ADR 0005](0005-internal-rbac-desk-roles.md), which reconciles the two
disagreeing matrices and adds the remaining internal roles' `DocPerm` rows. Portal-facing
roles (`Parent/Guardian`, `Student`) are still provisional, deferred to Phase 5.

## Context

The spec contains two different role/permission matrices that don't agree with each
other:

- §8.1 "Master Permissions Matrix" — 7 personas: Bursar/Accountant, School Head, SDC
  Chairperson/Treasurer, Parent/Guardian, Student, System Administrator, District
  Education Auditor/Inspector.
- A second §8 "Role-Based Access Matrix" — 6 roles: Cashier, Senior Bursar/Bookkeeper,
  Head of School/Accounting Officer, SDC Chairperson/Treasurer, External Auditor,
  District MoPSE Inspector.

They disagree on whether "Cashier" is a distinct role from "Bursar," and whether
"External Auditor" is distinct from "District MoPSE Inspector."

## Decision (interim, Phase 1 only)

Phase 1 ships with a provisional role set, created via `patches/create_roles.py`:
`School Head`, `Bursar`, and `Fees Approver` (approves Fee Structures) — plus Frappe's
built-in `System Manager`. `School Setup`/`School Banking Configuration` permissions
also reference `System Admin`, which is not currently created by any patch or fixture
in this app; Frappe will auto-create the Role record on DocType sync if it's missing,
but it should be added to `create_roles.py` explicitly once the RBAC list below is
reconciled, for clarity. This is enough to exercise the governance-gate workflow and
the invoice→receipt→ledger loop without committing to a role model that might be wrong.

## Consequences

- Full RBAC (Cashier vs Bursar split, Parent/Student portal roles, SDC/auditor
  read-only roles, District MoPSE Inspector) is deferred until the two matrices are
  reconciled into one canonical list — a decision for the product owner, not something
  to infer from the spec.
- Do not build permission fixtures for Phase 2+ roles until this ADR is updated to
  "Accepted" with the reconciled list.
