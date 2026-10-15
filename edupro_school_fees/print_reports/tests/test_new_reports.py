"""Smoke tests for the four reports print_reports' own README listed as
"not yet built" -- Bank Reconciliation, Budget Vote Book Variance, BEAM
Reconciliation, MoPSE ED46 Return. Same pattern as test_receipt_report.py:
render the real template through the real PDF service against real
(test-fixture) data, and check the output is an actual PDF -- these don't
re-test each underlying doctype's own business rules."""

import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.print_reports.services.pdf_service import generate_pdf, render_html
from edupro_school_fees.print_reports.services.report_service import (
    build_bank_reconciliation_context,
    build_beam_reconciliation_context,
    build_budget_variance_context,
    build_ed46_return_context,
)


def _sample_context(title):
    return {
        "branding": {}, "is_sample": True, "generated_on": "2026-01-15 09:00",
        "doc_title": title, "doc_meta": [("Test", "true")],
    }


class TestBankReconciliationReport(FrappeTestCase):
    def setUp(self):
        frappe.set_user("Administrator")

    def _make_reconciliation(self):
        if not frappe.db.exists("Account", "Print Report Test Bank"):
            frappe.get_doc({
                "doctype": "Account", "account_name": "Print Report Test Bank", "account_type": "Asset", "currency": "USD",
            }).insert()
        return frappe.get_doc({
            "doctype": "Bank Reconciliation", "bank_account": "Print Report Test Bank",
            "period_end": "2026-01-31", "balance_per_statement": 0,
        }).insert(ignore_if_duplicate=True)

    def test_context_has_no_invented_fields(self):
        self._make_reconciliation()
        context = build_bank_reconciliation_context(bank_account="Print Report Test Bank")
        self.assertEqual(context.title, "Bank Reconciliation Report")
        self.assertTrue(any("Print Report Test Bank" in row for row in context.tables[0].rows))

    def test_pdf_generates(self):
        self._make_reconciliation()
        context = build_bank_reconciliation_context(bank_account="Print Report Test Bank")
        pdf_bytes = generate_pdf("financial/generic_report.html", {"report": context, **_sample_context(context.title)})
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))


class TestBudgetVarianceReport(FrappeTestCase):
    def setUp(self):
        frappe.set_user("Administrator")

    def _make_budget_line(self):
        for account_name in ("Print Report Test Expense",):
            if not frappe.db.exists("Account", account_name):
                frappe.get_doc({"doctype": "Account", "account_name": account_name, "account_type": "Expense", "currency": "USD"}).insert()

        academic_year = frappe.get_doc({
            "doctype": "Academic Year", "academic_year_name": "Print Report Test Variance Year",
            "start_date": "2026-01-01", "end_date": "2026-12-31",
        }).insert(ignore_if_duplicate=True)
        vote_book = frappe.get_doc({"doctype": "Budget Vote Book", "academic_year": academic_year.name}).insert(ignore_if_duplicate=True)
        return frappe.get_doc({
            "doctype": "Budget Line", "budget_vote_book": vote_book.name, "vote_code": "TEST-001",
            "description": "Print report test line", "fund": "Fund A - General/Government",
            "expense_account": "Print Report Test Expense", "approved_budget": 500,
        }).insert(ignore_if_duplicate=True)

    def test_context_has_no_invented_fields(self):
        line = self._make_budget_line()
        context = build_budget_variance_context(budget_vote_book=line.budget_vote_book)
        self.assertEqual(context.title, "Budget Vote Book Variance Report")
        self.assertTrue(any("TEST-001" in row for row in context.tables[0].rows))

    def test_pdf_generates(self):
        line = self._make_budget_line()
        context = build_budget_variance_context(budget_vote_book=line.budget_vote_book)
        pdf_bytes = generate_pdf("financial/generic_report.html", {"report": context, **_sample_context(context.title)})
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))


class TestBeamReconciliationReport(FrappeTestCase):
    def setUp(self):
        frappe.set_user("Administrator")

    def _make_claim(self):
        academic_year = frappe.get_doc({
            "doctype": "Academic Year", "academic_year_name": "Print Report Test BEAM Year",
            "start_date": "2026-01-01", "end_date": "2026-12-31",
        }).insert(ignore_if_duplicate=True)
        term_name = frappe.get_all("Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name")[0]
        category = frappe.get_doc({"doctype": "Beneficiary Category", "category_name": "Print Report Test BEAM Cat"}).insert(ignore_if_duplicate=True)
        student = frappe.get_doc({
            "doctype": "Student", "first_name": "BeamReport", "last_name": "Test",
            "admission_date": "2026-01-05", "academic_year": academic_year.name, "beneficiary_category": category.name,
        }).insert(ignore_if_duplicate=True)
        return frappe.get_doc({
            "doctype": "BEAM Claim", "student": student.name, "term": term_name, "claim_date": "2026-01-10",
            "tuition_arrears_claimed": 80, "sdc_levy_arrears_claimed": 20,
        }).insert(ignore_if_duplicate=True)

    def test_context_has_no_invented_fields(self):
        claim = self._make_claim()
        context = build_beam_reconciliation_context(term=claim.term)
        self.assertEqual(context.title, "BEAM Reconciliation Report")
        self.assertTrue(any("BeamReport Test" in row for row in context.tables[0].rows))

    def test_pdf_generates(self):
        claim = self._make_claim()
        context = build_beam_reconciliation_context(term=claim.term)
        pdf_bytes = generate_pdf("financial/generic_report.html", {"report": context, **_sample_context(context.title)})
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))


class TestEd46ReturnReport(FrappeTestCase):
    def setUp(self):
        frappe.set_user("Administrator")

    def _make_return(self):
        academic_year = frappe.get_doc({
            "doctype": "Academic Year", "academic_year_name": "Print Report Test ED46 Year",
            "start_date": "2026-01-01", "end_date": "2026-12-31",
        }).insert(ignore_if_duplicate=True)
        term_name = frappe.get_all("Term", filters={"academic_year": academic_year.name, "term_number": 1}, limit=1, pluck="name")[0]
        existing = frappe.db.exists("MoPSE ED46 Return", {"term": term_name})
        if existing:
            return frappe.get_doc("MoPSE ED46 Return", existing)
        return frappe.get_doc({
            "doctype": "MoPSE ED46 Return", "term": term_name, "school_name": "Print Report Test School",
            "emis_number": "EMIS-TEST-001", "region": "Harare", "total_enrolment": 250,
            "total_revenue_billed": 10000, "total_revenue_realized": 8000,
        }).insert()

    def test_context_has_no_invented_fields(self):
        ed46 = self._make_return()
        context = build_ed46_return_context(ed46.name)
        self.assertEqual(context.school_name, "Print Report Test School")
        self.assertEqual(context.total_enrolment, 250)
        self.assertFalse(context.bursar_certified)

    def test_html_renders_with_signature_placeholders(self):
        ed46 = self._make_return()
        context = build_ed46_return_context(ed46.name)
        html = render_html("financial/ed46_return.html", {"ed46": context, **_sample_context("MoPSE ED46 Return")})
        self.assertIn("Print Report Test School", html)
        self.assertIn("Senior Bursar", html)

    def test_pdf_generates(self):
        ed46 = self._make_return()
        context = build_ed46_return_context(ed46.name)
        pdf_bytes = generate_pdf("financial/ed46_return.html", {"ed46": context, **_sample_context("MoPSE ED46 Return")})
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
