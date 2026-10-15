import frappe
from frappe.tests.utils import FrappeTestCase


class TestKBAnalyticsEvent(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_article_view_requires_article_slug(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({"doctype": "KB Analytics Event", "event_type": "Article View"}).insert()

	def test_search_requires_search_query(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({"doctype": "KB Analytics Event", "event_type": "Search"}).insert()

	def test_feedback_requires_article_slug_and_vote(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "KB Analytics Event", "event_type": "Feedback", "article_slug": "test-article-a",
			}).insert()

	def test_valid_article_view_inserts_cleanly(self):
		doc = frappe.get_doc({
			"doctype": "KB Analytics Event", "event_type": "Article View", "article_slug": "test-article-a",
		}).insert()
		self.assertEqual(doc.user, "Administrator")
		self.assertTrue(doc.logged_on)
