# ADR 0006: No Desk access for anyone but System Manager — custom frontend for everyone else

## Status

Accepted.

## Context

The Phase 2–9 roadmap was drafted assuming every role would work through Frappe's Desk
UI, using DocPerm/workflow permissions as the sole access-control layer — standard for a
Frappe app. Mid-review, explicit direction reversed this: *"all the users must not be able
to login Desk, only super admin must have access to desk."* This is a late but material
change: every role except `System Manager` now needs real screens in a custom frontend,
not just backend DocTypes with Desk's auto-generated forms.

## Decision

- **`desk_access = 0`** on every role this app creates (`School Head`, `Bursar`, `Fees
  Approver` via `patches/lock_down_desk_access.py`, which also updates
  `patches/create_roles.py`'s own definitions for fresh installs; `SDC
  Chairperson/Treasurer` and `District Education Auditor/Inspector` from creation, via
  `patches/create_extended_roles.py`). Only `System Manager` (the Administrator account)
  keeps Desk access, for infrastructure-level troubleshooting and oversight.
- **Frappe's permission engine stays the single source of truth regardless of UI.**
  `desk_access = 0` only blocks the `/app` Desk interface itself — DocPerm, workflow
  transitions, and `permission_query_conditions` all still apply identically when the
  same user calls the REST API from the custom frontend. The frontend is a presentation
  layer, not a second authorization system; see ADR 0005 for the actual DocPerm matrix.
- **Deployment topology**: the frontend (`web/`, see its own `README.md`) shares
  `fees.edupro.co.zw` with the Frappe backend via Traefik `PathPrefix` routing + router
  `priority` — the same pattern already proven by Edupro Academy on this infrastructure
  (see `eduprocloud`'s `edupro-devops` skill). Same-origin means no CORS configuration is
  needed. Frappe keeps `/app` (Desk, System-Manager-only in practice now) and `/api`; the
  Next.js frontend catches everything else at lower router priority.
- **Auth**: the frontend authenticates against Frappe's own session/login API
  (`/api/method/login`), so the session cookie carries auth to both the frontend's own
  pages and its calls into Frappe's REST API — no separate auth/token infrastructure to
  build or keep in sync.

## Consequences

- Every phase from Phase 4 onward needs real frontend screens, not just backend
  DocTypes — a genuine scope increase over the original Desk-based assumption, flagged
  plainly rather than downplayed when the roadmap was revised.
- `desk_access = 0` is necessary but not sufficient on its own: it hides the Desk UI, but
  a user who calls Frappe's REST/RPC API directly (not through the frontend) is still
  governed by ordinary DocPerm/workflow/permission-query-condition rules — which is the
  intended behavior (see above), not a gap, but worth stating so nobody assumes
  `desk_access = 0` is itself an access-control mechanism.
- Verification for this ADR (per the roadmap's own Phase 4 checklist): confirm every
  non-`System Manager` role is actually blocked from `/app` at the HTTP/session level,
  not just hidden in the UI, and confirm the frontend's login flow works end-to-end for
  at least one role via a real browser before calling Phase 4 done.
