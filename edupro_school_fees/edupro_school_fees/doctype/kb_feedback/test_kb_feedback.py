import frappe
from frappe.tests.utils import FrappeTestCase


class TestKBFeedback(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create_and_read(self):
		doc = frappe.get_doc({
			"doctype": "KB Feedback",
			"article_slug": "test-article-a",
			"vote": "Up",
		}).insert()

		self.assertEqual(doc.user, "Administrator")
		self.assertTrue(doc.submitted_on)

	def test_rejects_a_second_vote_for_the_same_user_and_article(self):
		frappe.get_doc({"doctype": "KB Feedback", "article_slug": "test-article-c", "vote": "Up"}).insert()
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({"doctype": "KB Feedback", "article_slug": "test-article-c", "vote": "Down"}).insert()
