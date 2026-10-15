"""Phase 5.5: Portal Invitation token lifecycle -- issue, redeem, revoke.

Security model (see docs/decisions/0008):
- Only the token's SHA-256 hash is ever stored. The raw token exists only in
  memory for the single create_portal_invitation() response and the one
  delivery attempt below (DEF-026) -- never logged, never persisted.
  Delivery reuses notifications.py's existing email/SMS infrastructure and
  never raises: if it fails or isn't configured, the token is still
  returned to the calling Bursar/School Head to relay out-of-band, same as
  before this was automated.
- Single-use: redemption claims the token via an atomic UPDATE ... WHERE
  used_at IS NULL, so two concurrent redemptions of the same token can't
  both succeed -- whichever commits first wins, the second sees 0 rows
  affected and is rejected. If everything after the claim fails (e.g. the
  email is already taken), Frappe rolls back the whole request -- including
  the claim -- so a failed redemption never permanently burns the token.
- Expiring: 7 days from issue, checked at redemption time.
- Revocable: Bursar/School Head can revoke an unused (not yet redeemed)
  invitation early; an already-used one can't be revoked after the fact.
- Rate-limited: both issue and redeem are IP-rate-limited (frappe.rate_limiter,
  the framework's own mechanism, not reinvented here) to make token
  enumeration/guessing expensive.
"""

import hashlib
import secrets

import frappe
from frappe.rate_limiter import rate_limit
from frappe.utils import add_days, get_datetime, now_datetime

INVITATION_VALIDITY_DAYS = 7
TOKEN_BYTES = 32
_STAFF_ROLES = {"Bursar", "School Head", "System Manager"}


def _hash_token(token):
	return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _require_staff_role():
	# Deliberately not frappe.only_for() -- it no-ops entirely under
	# frappe.flags.in_test (and for the Administrator user), which would make
	# this check untestable by the very test suite meant to gate it.
	if not _STAFF_ROLES.intersection(frappe.get_roles()):
		frappe.throw("Not permitted.", frappe.PermissionError)


@frappe.whitelist()
@rate_limit(limit=20, seconds=60 * 60)
def create_portal_invitation(parent_guardian):
	_require_staff_role()

	guardian = frappe.get_doc("Parent Guardian", parent_guardian)
	if guardian.user:
		frappe.throw(f"{guardian.full_name} already has a portal account linked.")

	if not guardian.phone_number and not guardian.email:
		frappe.throw("This guardian has no phone number or email on file to invite through.")

	channel = "Phone" if guardian.phone_number else "Email"
	target = guardian.phone_number or guardian.email

	token = secrets.token_urlsafe(TOKEN_BYTES)
	expires_at = add_days(now_datetime(), INVITATION_VALIDITY_DAYS)

	invitation = frappe.get_doc({
		"doctype": "Portal Invitation",
		"parent_guardian": guardian.name,
		"token_hash": _hash_token(token),
		"delivery_channel": channel,
		"delivery_target": target,
		"expires_at": expires_at,
	})
	invitation.insert(ignore_permissions=True)

	invite_url = frappe.utils.get_url(f"/invite/{token}")
	message = (
		f"You've been invited to the Edupro School Fees parent portal for {guardian.full_name}. "
		f"Open this link to set up your account: {invite_url} (valid until {expires_at})."
	)
	from edupro_school_fees.notifications import _send_email, _send_sms
	if channel == "Email":
		_send_email(target, "Your parent portal invitation", message, parent_guardian=guardian.name)
	else:
		_send_sms(target, message, parent_guardian=guardian.name)

	return {
		"invitation": invitation.name,
		"token": token,
		"delivery_channel": channel,
		"delivery_target": target,
		"expires_at": expires_at,
	}


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=10, seconds=60 * 60)
def redeem_portal_invitation(token, email, password, first_name, last_name=None):
	if not token or not email or not password or not first_name:
		frappe.throw("Token, email, first name and password are required.")

	invitation_name = frappe.db.get_value(
		"Portal Invitation", {"token_hash": _hash_token(token)}, "name"
	)
	if not invitation_name:
		frappe.throw("This invitation link is invalid.")

	invitation = frappe.get_doc("Portal Invitation", invitation_name)
	if invitation.revoked_at:
		frappe.throw("This invitation has been revoked.")
	if get_datetime(invitation.expires_at) < now_datetime():
		frappe.throw("This invitation has expired.")

	# Atomic single-use claim -- see module docstring.
	frappe.db.sql(
		"UPDATE `tabPortal Invitation` SET used_at = %(now)s WHERE name = %(name)s AND used_at IS NULL",
		{"now": now_datetime(), "name": invitation_name},
	)
	if not frappe.db.sql("SELECT ROW_COUNT()")[0][0]:
		frappe.throw("This invitation has already been used.")

	guardian = frappe.get_doc("Parent Guardian", invitation.parent_guardian)
	if guardian.user:
		frappe.throw("This guardian already has a portal account linked.")
	if frappe.db.exists("User", email):
		frappe.throw("An account with this email already exists.")

	user = frappe.get_doc({
		"doctype": "User",
		"email": email,
		"first_name": first_name,
		"last_name": last_name,
		"send_welcome_email": 0,
		"new_password": password,
	})
	user.append("roles", {"role": "Parent/Guardian"})
	user.insert(ignore_permissions=True)

	guardian.user = user.name
	guardian.save(ignore_permissions=True)

	return {"success": True, "email": user.name}


@frappe.whitelist()
def revoke_portal_invitation(name):
	_require_staff_role()

	invitation = frappe.get_doc("Portal Invitation", name)
	if invitation.used_at:
		frappe.throw("This invitation has already been used and cannot be revoked.")
	if invitation.revoked_at:
		return {"success": True}

	invitation.revoked_at = now_datetime()
	invitation.revoked_by = frappe.session.user
	invitation.save()
	return {"success": True}
