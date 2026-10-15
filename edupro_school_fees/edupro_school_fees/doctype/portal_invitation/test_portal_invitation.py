"""Phase 5.5 hard gate (per the roadmap's own Phase 5 verification checklist):
expiry, single-use, revocation, and role-gating on the invitation token flow,
before this is ever cleared to power real portal signup.
"""

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, now_datetime

from edupro_school_fees.portal_invitations import (
	create_portal_invitation,
	redeem_portal_invitation,
	revoke_portal_invitation,
)


class TestPortalInvitation(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _make_bursar(self, suffix):
		# Frappe normalizes User email/name to lowercase on creation -- build
		# it lowercase to begin with so this always matches what's actually
		# stored (found live: revoked_by came back lowercase while this
		# suffix, an uppercase test-id letter, was not).
		email = f"pi-bursar-{suffix}@rbac.test".lower()
		if not frappe.db.exists("User", email):
			user = frappe.get_doc({
				"doctype": "User",
				"email": email,
				"first_name": f"Bursar{suffix}",
				"send_welcome_email": 0,
			}).insert(ignore_permissions=True)
		else:
			user = frappe.get_doc("User", email)
		if not any(r.role == "Bursar" for r in user.roles):
			user.append("roles", {"role": "Bursar"})
			user.save(ignore_permissions=True)
		return email

	def _make_guardian(self, suffix, with_contact=True):
		return frappe.get_doc({
			"doctype": "Parent Guardian",
			"full_name": f"PI Test Guardian {suffix}",
			"phone_number": "0771234567" if with_contact else None,
		}).insert()

	def test_create_invitation_requires_staff_role(self):
		guardian = self._make_guardian("A")
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			create_portal_invitation(guardian.name)

	def test_create_invitation_attempts_delivery_without_raising(self):
		# DEF-026: invitations used to be created but never actually sent --
		# the Bursar had to relay the token out-of-band by hand. Delivery
		# infra (SMS/email) is typically unconfigured in this environment, so
		# this only proves the attempt never breaks the call, same
		# never-raise contract as every other notification in the app.
		guardian = self._make_guardian("Z")
		bursar = self._make_bursar("Z")
		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)
		self.assertEqual(result["delivery_channel"], "Phone")
		self.assertTrue(result["token"])

	def test_create_invitation_fails_if_guardian_already_linked(self):
		bursar = self._make_bursar("B")
		guardian = self._make_guardian("B")
		guardian.user = bursar  # any existing User works for this check
		guardian.save()

		frappe.set_user(bursar)
		with self.assertRaises(frappe.ValidationError):
			create_portal_invitation(guardian.name)

	def test_create_invitation_fails_without_contact_info(self):
		bursar = self._make_bursar("C")
		guardian = self._make_guardian("C", with_contact=False)

		frappe.set_user(bursar)
		with self.assertRaises(frappe.ValidationError):
			create_portal_invitation(guardian.name)

	def test_token_hash_never_stores_raw_token(self):
		bursar = self._make_bursar("D")
		guardian = self._make_guardian("D")

		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)

		stored_hash = frappe.db.get_value("Portal Invitation", result["invitation"], "token_hash")
		self.assertNotEqual(stored_hash, result["token"])
		self.assertEqual(len(stored_hash), 64)  # sha256 hex digest length

	def test_redeem_valid_token_creates_user_and_links_guardian(self):
		bursar = self._make_bursar("E")
		guardian = self._make_guardian("E")

		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)

		frappe.set_user("Guest")
		redeem_result = redeem_portal_invitation(
			token=result["token"],
			email="new-parent-e@rbac.test",
			password="a-strong-test-password-1",
			first_name="New",
			last_name="Parent",
		)
		self.assertTrue(redeem_result["success"])

		frappe.set_user("Administrator")
		guardian.reload()
		self.assertEqual(guardian.user, "new-parent-e@rbac.test")
		self.assertIn("Parent/Guardian", frappe.get_roles("new-parent-e@rbac.test"))
		self.assertTrue(frappe.db.get_value("Portal Invitation", result["invitation"], "used_at"))

	def test_redeem_wrong_token_fails(self):
		bursar = self._make_bursar("F")
		guardian = self._make_guardian("F")
		frappe.set_user(bursar)
		create_portal_invitation(guardian.name)

		frappe.set_user("Guest")
		with self.assertRaises(frappe.ValidationError):
			redeem_portal_invitation(
				token="not-a-real-token",
				email="nope-f@rbac.test",
				password="a-strong-test-password-1",
				first_name="Nope",
			)

	def test_redeem_expired_token_fails(self):
		bursar = self._make_bursar("G")
		guardian = self._make_guardian("G")
		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)

		frappe.set_user("Administrator")
		frappe.db.set_value(
			"Portal Invitation", result["invitation"], "expires_at", add_days(now_datetime(), -1)
		)

		frappe.set_user("Guest")
		with self.assertRaises(frappe.ValidationError):
			redeem_portal_invitation(
				token=result["token"],
				email="expired-g@rbac.test",
				password="a-strong-test-password-1",
				first_name="Expired",
			)

	def test_redeem_revoked_token_fails(self):
		bursar = self._make_bursar("H")
		guardian = self._make_guardian("H")
		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)
		revoke_portal_invitation(result["invitation"])

		frappe.set_user("Guest")
		with self.assertRaises(frappe.ValidationError):
			redeem_portal_invitation(
				token=result["token"],
				email="revoked-h@rbac.test",
				password="a-strong-test-password-1",
				first_name="Revoked",
			)

	def test_redeem_used_token_fails_second_time(self):
		bursar = self._make_bursar("I")
		guardian = self._make_guardian("I")
		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)

		frappe.set_user("Guest")
		redeem_portal_invitation(
			token=result["token"],
			email="once-i@rbac.test",
			password="a-strong-test-password-1",
			first_name="Once",
		)
		with self.assertRaises(frappe.ValidationError):
			redeem_portal_invitation(
				token=result["token"],
				email="twice-i@rbac.test",
				password="a-strong-test-password-1",
				first_name="Twice",
			)

	def test_revoke_unused_invitation(self):
		bursar = self._make_bursar("J")
		guardian = self._make_guardian("J")
		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)
		revoke_portal_invitation(result["invitation"])

		invitation = frappe.get_doc("Portal Invitation", result["invitation"])
		self.assertTrue(invitation.revoked_at)
		self.assertEqual(invitation.revoked_by, bursar)

	def test_revoke_used_invitation_fails(self):
		bursar = self._make_bursar("K")
		guardian = self._make_guardian("K")
		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)

		frappe.set_user("Guest")
		redeem_portal_invitation(
			token=result["token"],
			email="used-k@rbac.test",
			password="a-strong-test-password-1",
			first_name="Used",
		)

		frappe.set_user(bursar)
		with self.assertRaises(frappe.ValidationError):
			revoke_portal_invitation(result["invitation"])

	def test_immutable_fields_locked_after_creation(self):
		bursar = self._make_bursar("L")
		guardian = self._make_guardian("L")
		frappe.set_user(bursar)
		result = create_portal_invitation(guardian.name)

		frappe.set_user("Administrator")
		invitation = frappe.get_doc("Portal Invitation", result["invitation"])
		invitation.expires_at = add_days(now_datetime(), 30)
		with self.assertRaises(frappe.ValidationError):
			invitation.save()
