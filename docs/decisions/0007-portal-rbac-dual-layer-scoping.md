# ADR 0007: Portal RBAC — dual-layer row scoping for Parent/Guardian and Student

## Status

Accepted for the backend scoping mechanism, and now exercised by real Phase 5.4 frontend
screens. **Not yet cleared to enable real portal signup** — see Consequences below.

## Context

The Phase 2–9 roadmap deliberately deferred portal RBAC to Phase 5, built alongside the
real Parent Portal views (Phase 5.4) rather than months ahead of them — the explicit
reasoning being that permission-scoping logic shouldn't be built (or trusted) before
there's a real view to exercise it against. Phase 4's internal RBAC (ADR 0005) only
needed ordinary DocPerm rows, since every internal role already goes through Frappe's
standard role-based evaluation. Portal roles are different: a `Parent/Guardian` or
`Student` DocPerm row grants read access to the *doctype*, but the actual requirement is
row-level — a parent may read their own children's records and nobody else's.

## Decision

**Two enforcement layers, both required:**

- **`permission_query_conditions`** (`edupro_school_fees/permissions.py`) — filters *list*
  queries by appending a SQL condition. Only exercised by `frappe.get_list()` (and Desk
  list views, and the `/api/resource/<doctype>` REST endpoint the frontend actually
  calls) — **not** by `frappe.get_all()`, which deliberately bypasses user permissions by
  design. The first version of `test_student.py` got this wrong (used `get_all()` for its
  list-query assertions, which passed regardless of what the hooks did) before being
  caught and fixed; worth stating plainly here since it's an easy mistake to repeat.
  This layer is necessary but not sufficient on its own.
- **`has_permission`** — governs a *single-record* fetch. Without this layer, a portal
  user who already knows (or guesses, or receives via a leaked link) another family's
  document name could still `frappe.get_doc()` it directly and have `check_permission()`
  succeed, even though it would never appear in their own list queries. This is a classic
  IDOR gap; both hooks are registered for every scoped doctype specifically to close it.

**Scoped doctypes and their rule:**

| DocType | Rule |
|---|---|
| `Student` | Own record (Student login) or any child linked via `Parent Guardian.name == Student.guardian` (Parent/Guardian login) |
| `Invoice` | Same student-ownership rule, via `Invoice.student` |
| `Receipt` | Same rule, via `Receipt.student` -- **Parent/Guardian only**. `Student` gets no DocPerm row on this doctype at all (spec: receipt downloads are a guardian duty, not a student one), so the query-condition/has_permission hooks never even run for a Student user here — enforced at the coarser DocPerm layer instead of duplicating the same logic. |
| `Fee Structure` | **Not family-scoped.** Any `workflow_state = "Approved"` structure is visible to every portal user, matching the spec's AGM-transparency intent ("parents can see what's being charged") — Draft/Pending/Rejected stay invisible regardless of whose child it would apply to. |
| `Payment Plan` | Same student-ownership rule, via `Payment Plan.student` -- **Parent/Guardian only**, same reasoning as Receipt (added alongside the Phase 5.4 statement screens, which need it for the "payment plan status" view the roadmap calls for). |
| `Parent Guardian` | Only the portal user's own record (matched via a new `user` Link field, populated when an invitation is eventually accepted in Phase 5.5) |

**Every function is a deliberate no-op for internal roles.** `_is_portal_user(roles)`
gates all six hook functions: for anyone who isn't `Parent/Guardian` or `Student` (i.e.
every internal role — Bursar, School Head, etc. — and `System Manager`), the
query-condition hooks return `""` (no added restriction) and the has_permission hooks
return `None` (no opinion), so evaluation falls through entirely to Frappe's ordinary
DocPerm-based check. Getting this backwards — scoping internal roles by accident — would
have silently broken Bursar's day-to-day access to every student's records, which is why
`test_internal_roles_unaffected_by_portal_scoping` exists as its own explicit regression
test rather than being assumed safe.

**Identity linking**: `Parent Guardian.user` and `Student.user` (both new, unique `Link`
to `User`) map a portal login to the record it's allowed to see. Both are nullable and
stay blank until Phase 5.5's invitation flow populates them — there is no signup path
that sets them yet, so no real user can currently become a portal user through normal
product use (only through direct Desk/API action by System Manager, per Phase 4's
Desk-access lockdown).

## Consequences

- **This is the "highest-risk regression surface in the roadmap" (the plan's own words)
  and its verification gate is explicit**: positive/negative permission tests — own
  records visible, another family's are not, checked via *both* list query and direct
  fetch — are a hard gate before portal signup is enabled in production.
  `test_student.py::TestPortalRBAC` implements that gate: two full families, a Bursar
  control case, and a Draft-vs-Approved Fee Structure visibility case.
- **What this ADR does NOT close out**: Phase 5.5's invitation-token flow (the only way
  `user` actually gets populated for a real family) still doesn't exist. The Phase 5.4
  frontend screens (`web/src/app/portal/`) call the same `/api/resource/<doctype>` REST
  endpoints these hooks scope, so they do exercise the real enforcement path — but only
  ever against `user` values set directly via Desk by System Manager, not through any
  product-facing signup. Do not treat this ADR as clearance to open portal signup; that
  still needs Phase 5.5, plus a manual end-to-end browser check with a real invited
  parent once it exists.
- A `Communication Log` was deliberately left unscoped here (no portal DocPerm row at
  all, per its own existing "no read outside Bursar/SDC/School Head" design from Phase
  5.2) — consistent, not an oversight.
