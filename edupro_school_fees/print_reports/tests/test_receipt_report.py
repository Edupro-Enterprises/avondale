"""Smoke test for the print_reports receipt pipeline -- renders the real
template through the real PDF service against a real (test-fixture)
Receipt, and checks the output is an actual PDF. Doesn't re-test Receipt's
own business rules (deletion/reversal/etc.) -- test_receipt.py already
owns those; this only tests that report_service + pdf_service can turn a
submitted Receipt into a PDF without errors."""

import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.print_reports.services.pdf_service import generate_pdf, render_html
from edupro_school_fees.print_reports.services.report_service import get_receipt_context


class TestReceiptReport(FrappeTestCase):
    def setUp(self):
        frappe.set_user("Administrator")

    def _make_receipt(self):
        for account_name, account_type in (
            ("Print Report Test Debtors", "Asset"),
            ("Print Report Test Income", "Income"),
            ("Print Report Test Cash", "Asset"),
        ):
            if not frappe.db.exists("Account", account_name):
                frappe.get_doc({
                    "doctype": "Account", "account_name": account_name, "account_type": account_type, "currency": "ZiG",
                }).insert()

        academic_year = frappe.get_doc({
            "doctype": "Academic Year", "academic_year_name": "Print Report Test Year",
            "start_date": "2026-01-01", "end_date": "2026-12-31",
        }).insert(ignore_if_duplicate=True)
        term_name = frappe.get_all(
            "Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name",
        )[0]
        category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "Print Report Test Cat"}).insert(ignore_if_duplicate=True)
        fee_item = frappe.get_doc({
            "doctype": "Fee Item", "item_name": "Print Report Test Fee", "default_amount": 100, "account": "Print Report Test Income",
        }).insert(ignore_if_duplicate=True)
        fee_structure = frappe.get_doc({
            "doctype": "Fee Structure", "structure_name": "Print Report Test Structure",
            "academic_year": academic_year.name, "term": term_name, "beneficiary_category": category.name,
            "items": [{"fee_item": fee_item.name, "amount": 100}],
            "agm_minutes": "/files/x.pdf", "mopse_approval_letter": "/files/y.pdf",
        }).insert(ignore_if_duplicate=True)
        fee_structure.workflow_state = "Approved"
        fee_structure.save(ignore_permissions=True)

        student = frappe.get_doc({
            "doctype": "Student", "first_name": "PrintReport", "last_name": "Test",
            "admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
        }).insert(ignore_if_duplicate=True)

        invoice = frappe.get_doc({
            "doctype": "Invoice", "student": student.name, "fee_structure": fee_structure.name,
            "posting_date": "2026-01-10", "items": [{"fee_item": fee_item.name, "amount": 100}],
        }).insert()
        invoice.submit()

        payment_method = frappe.get_doc({
            "doctype": "Payment Method", "method_name": "Print Report Test Cash Method", "account": "Print Report Test Cash", "currency": "ZiG",
        }).insert(ignore_if_duplicate=True)

        receipt = frappe.get_doc({
            "doctype": "Receipt", "student": student.name, "invoice": invoice.name,
            "payment_method": payment_method.name, "amount": 40, "posting_date": "2026-01-15",
        }).insert()
        receipt.submit()
        return receipt

    def test_receipt_context_has_no_invented_fields(self):
        receipt = self._make_receipt()
        context, _qr = get_receipt_context(receipt.name)
        self.assertEqual(context.name, receipt.name)
        self.assertEqual(context.student_name, "PrintReport Test")
        self.assertIn("$", context.outstanding_balance_display)

    def test_receipt_html_renders(self):
        receipt = self._make_receipt()
        context, qr_data_uri = get_receipt_context(receipt.name)
        html = render_html("financial/receipt.html", {
            "receipt": context,
            "branding": {},
            "qr_data_uri": qr_data_uri,
            "is_reprint": False,
            "is_sample": True,
            "generated_on": "2026-01-15 09:00",
            "doc_title": "Official Receipt",
            "doc_meta": [("Receipt No.", context.name)],
        })
        self.assertIn(receipt.name, html)
        self.assertIn("Sample data", html)  # is_sample banner rendered

    def test_receipt_pdf_generates(self):
        receipt = self._make_receipt()
        context, qr_data_uri = get_receipt_context(receipt.name)
        pdf_bytes = generate_pdf("financial/receipt.html", {
            "receipt": context,
            "branding": {},
            "qr_data_uri": qr_data_uri,
            "is_reprint": False,
            "is_sample": True,
            "generated_on": "2026-01-15 09:00",
            "doc_title": "Official Receipt",
            "doc_meta": [("Receipt No.", context.name)],
        })
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
