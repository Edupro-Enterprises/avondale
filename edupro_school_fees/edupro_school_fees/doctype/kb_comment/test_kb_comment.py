import frappe
from frappe.tests.utils import FrappeTestCase


class TestKBComment(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create_and_read(self):
		doc = frappe.get_doc({
			"doctype": "KB Comment",
			"article_slug": "test-article-a",
			"body": "This is a helpful article.",
		}).insert()

		self.assertEqual(doc.user, "Administrator")
		self.assertTrue(doc.commented_on)

	def test_rejects_an_empty_body(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({"doctype": "KB Comment", "article_slug": "test-article-a", "body": "   "}).insert()

	def test_rejects_an_overly_long_body(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({
				"doctype": "KB Comment", "article_slug": "test-article-a", "body": "x" * 2001,
			}).insert()
