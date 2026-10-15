"""Exercises the whitelisted API in knowledge_base.py directly (not over
HTTP -- frappe.whitelist() doesn't stop a plain Python call in tests,
matching how the rest of this app's whitelisted-method tests work)."""

import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees import knowledge_base as kb


class TestKnowledgeBaseApi(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _make_user(self, email):
		if not frappe.db.exists("User", email):
			frappe.get_doc({
				"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0,
			}).insert(ignore_permissions=True)
		return email

	def test_toggle_favourite_flips_on_then_off(self):
		result = kb.toggle_favourite("kb-test-toggle")
		self.assertTrue(result["is_favourite"])

		result = kb.toggle_favourite("kb-test-toggle")
		self.assertFalse(result["is_favourite"])

	def test_update_progress_rejects_an_invalid_status(self):
		with self.assertRaises(frappe.ValidationError):
			kb.update_progress("kb-test-progress", "Something Else")

	def test_update_progress_upserts_the_same_row(self):
		kb.update_progress("kb-test-progress-2", "In Progress")
		kb.update_progress("kb-test-progress-2", "Read")
		self.assertEqual(
			frappe.db.count(
				"KB Reading Activity", {"article_slug": "kb-test-progress-2", "user": "Administrator"}
			),
			1,
		)

	def test_submit_feedback_is_idempotent_per_user_and_article(self):
		kb.submit_feedback("kb-test-feedback", "up")
		kb.submit_feedback("kb-test-feedback", "down")
		rows = frappe.db.get_list(
			"KB Feedback", filters={"article_slug": "kb-test-feedback", "user": "Administrator"}, fields=["vote"]
		)
		self.assertEqual(len(rows), 1)
		self.assertEqual(rows[0].vote, "Down")

	def test_submit_feedback_rejects_an_invalid_vote(self):
		with self.assertRaises(frappe.ValidationError):
			kb.submit_feedback("kb-test-feedback-2", "sideways")

	def test_get_my_kb_state_aggregates_favourites_progress_and_votes(self):
		kb.toggle_favourite("kb-test-state")
		kb.update_progress("kb-test-state", "Read")
		kb.submit_feedback("kb-test-state", "up")

		state = kb.get_my_kb_state()
		self.assertIn("kb-test-state", state["favourites"])
		self.assertEqual(state["progress"]["kb-test-state"], "Read")
		self.assertEqual(state["votes"]["kb-test-state"], "up")

	def test_add_get_and_delete_comment(self):
		created = kb.add_comment("kb-test-comment", "Very useful, thank you.")
		self.assertEqual(created["author_id"], "Administrator")

		comments = kb.get_comments("kb-test-comment")
		self.assertTrue(any(c["id"] == created["id"] for c in comments))

		kb.delete_comment(created["id"])
		self.assertFalse(frappe.db.exists("KB Comment", created["id"]))

	def test_system_manager_may_moderate_anyones_comment(self):
		other = self._make_user("kb-comment-owner@rbac.test")
		frappe.set_user(other)
		created = kb.add_comment("kb-test-comment-2", "Owned by someone else.")

		frappe.set_user("Administrator")  # System Manager -- allowed to delete a comment it doesn't own
		kb.delete_comment(created["id"])
		self.assertFalse(frappe.db.exists("KB Comment", created["id"]))

	def test_a_non_admin_cannot_delete_someone_elses_comment(self):
		owner = self._make_user("kb-comment-owner-2@rbac.test")
		intruder = self._make_user("kb-comment-intruder@rbac.test")

		frappe.set_user(owner)
		created = kb.add_comment("kb-test-comment-3", "Owned by the first user.")

		frappe.set_user(intruder)
		with self.assertRaises(frappe.PermissionError):
			kb.delete_comment(created["id"])

	def test_track_events_inserts_valid_events_and_skips_malformed_ones(self):
		result = kb.track_events([
			{"type": "article_view", "slug": "kb-test-analytics"},
			{"type": "search", "query": "cash up", "resultCount": 3},
			{"type": "feedback", "slug": "kb-test-analytics", "vote": "up"},
			{"type": "not-a-real-type"},
		])
		self.assertEqual(result["inserted"], 3)
		self.assertEqual(result["skipped"], 1)
