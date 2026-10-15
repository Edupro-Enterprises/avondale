import frappe
from frappe.tests.utils import FrappeTestCase


class TestKBReadingActivity(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_create_and_read(self):
		doc = frappe.get_doc({
			"doctype": "KB Reading Activity",
			"article_slug": "test-article-a",
			"is_favourite": 1,
			"status": "In Progress",
		}).insert()

		self.assertEqual(doc.user, "Administrator")
		self.assertTrue(doc.last_visited)

	def test_rejects_a_second_row_for_the_same_user_and_article(self):
		frappe.get_doc({"doctype": "KB Reading Activity", "article_slug": "test-article-b"}).insert()
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({"doctype": "KB Reading Activity", "article_slug": "test-article-b"}).insert()
