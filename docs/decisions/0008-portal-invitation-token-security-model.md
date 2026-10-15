# ADR 0008: Portal invitation-token security model

## Status

Accepted for the token lifecycle mechanism. **Not yet cleared to enable real portal
signup** — see Consequences; this is the last piece the roadmap named as a prerequisite
(ADR 0007's own closing line), but delivery automation still doesn't exist (see below).

## Context

The Phase 2–9 roadmap named this explicitly, ahead of coding the signup flow: token
schema, single-use, revocation, rate-limiting, and delivery-channel discipline. Phase 5.1
built the `Parent Guardian`/`Student.user` link fields these tokens ultimately populate,
but left them permanently blank — there was no path that could ever set them. This ADR
is that path.

## Decision

**`Portal Invitation` DocType**, not a bare field on `Parent Guardian`:
`parent_guardian` (Link), `token_hash` (the token's SHA-256 hex digest — the raw token is
never persisted anywhere, existing only in memory for the single API response that
issues it), `delivery_channel`/`delivery_target` (the guardian's own phone or email
already on file — never a value the caller supplies, so an invitation can't be issued to
an address of the caller's choosing), `expires_at`, `used_at`, `revoked_at`/`revoked_by`.
Immutable after creation except `used_at` (settable exactly once) and
`revoked_at`/`revoked_by` (settable exactly once) — enforced in the controller's
`on_update`, same locked-history pattern as `Exchange Rate` (ADR 0004).

**Three whitelisted methods** (`edupro_school_fees/portal_invitations.py`):

- **`create_portal_invitation(parent_guardian)`** — Bursar/School Head/System Manager
  only, rate-limited (20/hour/IP). Rejects a guardian who already has a linked `user`, or
  has neither phone nor email on file. Generates a 32-byte `secrets.token_urlsafe` token,
  stores only its hash, returns the raw token in the response.
- **`redeem_portal_invitation(token, email, password, first_name, last_name)`** —
  `allow_guest=True` (the whole point: the person redeeming it has no account yet),
  rate-limited (10/hour/IP). Validates not-revoked and not-expired, then **atomically
  claims** the token via `UPDATE ... SET used_at = now() WHERE used_at IS NULL` and checks
  the affected row count — the standard compare-and-swap pattern, safe under two
  concurrent redemptions of the same token (whichever commits first wins; the loser sees
  0 rows affected). Only after a successful claim does it create the `User` and link
  `Parent Guardian.user` — if that later step throws for any reason (duplicate email,
  etc.), Frappe rolls back the *whole* request, including the claim, so a failed
  redemption never permanently burns a valid token.
- **`revoke_portal_invitation(name)`** — Bursar/School Head/System Manager only. Refuses
  to revoke an already-used invitation (nothing left to revoke); revoking an
  already-revoked one is a no-op, not an error.

**Role-gating deliberately avoids `frappe.only_for()`.** That helper no-ops entirely when
`frappe.flags.in_test` is set (and for the `Administrator` user) — exactly the two
conditions every test in this suite runs under, which would make a negative
("non-staff can't call this") test pass regardless of whether the real check works.
`_require_staff_role()` is a plain role-set intersection instead, with no test-mode
escape hatch, so `test_create_invitation_requires_staff_role` actually exercises it.

**Rate limiting** uses `frappe.rate_limiter.rate_limit` (the framework's own mechanism,
IP-based by default) rather than a hand-rolled per-token attempt counter.

## Consequences

- **No delivery automation exists.** `create_portal_invitation`'s raw-token response is,
  today, the *only* delivery mechanism — the calling Bursar/School Head reads it and
  relays it out-of-band (phone call, in person, etc.). No SMS gateway or outbound email
  infrastructure exists for this app (unlike Edupro Academy, which built its own SMTP
  config for a similar signup flow — see eduprocloud's edupro-devops skill, "HBC
  self-registration"). Automating this is real, separate work: wiring a channel, storing
  credentials, handling delivery failures — not something to bolt on silently here.
- **Rate-limit behavior isn't covered by the automated test suite** — genuinely exercising
  it means firing enough requests to trip the Redis-backed counter, which is slow and
  flaky as a unit test. Verified by code review (the decorator is applied, with the
  framework's own tested default IP-based behavior) rather than by a dedicated test; flag
  this if the limits themselves ever need tuning.
- **What this ADR does not close out**: a frontend signup page that actually calls
  `redeem_portal_invitation` (built alongside this ADR, see `web/src/app/invite/`) proves
  the mechanism end-to-end for a browser session, but no internal "Invite Parent" UI
  exists yet for a Bursar to trigger `create_portal_invitation` — until that's built (or a
  System Manager issues one directly via the API/Desk), invitations exist as a proven,
  tested backend capability, not yet a repeatable staff workflow.
