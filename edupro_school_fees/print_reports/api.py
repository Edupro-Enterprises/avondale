"""Whitelisted entry points for the print_reports package. Kept separate
from report_service.py so that module can be imported/tested without
pulling in frappe.whitelist()'s request-context assumptions."""

from datetime import datetime

import frappe

from edupro_school_fees.print_reports.services.branding_service import get_school_branding
from edupro_school_fees.print_reports.services.pdf_service import generate_pdf
from edupro_school_fees.print_reports.services.report_service import (
    build_bank_reconciliation_context,
    build_beam_reconciliation_context,
    build_budget_variance_context,
    build_cashbook_context,
    build_class_level_fee_summary_context,
    build_class_list_context,
    build_daily_cash_collection_context,
    build_ed46_return_context,
    build_financial_position_context,
    build_fixed_assets_register_context,
    build_income_expenditure_context,
    build_outstanding_fees_context,
    build_payment_summary_context,
    build_receipts_and_payments_context,
    build_student_statement_context,
    build_trial_balance_context,
    get_receipt_context,
)

# wkhtmltopdf ignores CSS `@page { size }` (confirmed live -- it fell back
# to its own default page size instead of the A5 the CSS asked for), so the
# receipt's small slip size has to be set through its own --page-* options.
RECEIPT_PDF_OPTIONS = {"page-width": "148mm", "page-height": "270mm", "margin-top": "0", "margin-bottom": "0", "margin-left": "0", "margin-right": "0"}

def _set_pdf_response(filename, pdf_bytes, as_attachment):
	"""Shared by every generate_*_pdf below -- as_attachment=True (the
	default) forces a browser download (frappe.utils.response.as_raw(),
	Content-Disposition: attachment); False renders inline instead
	(frappe.utils.response.as_pdf(), Content-Disposition: inline) so a
	"View" action can open it in a new tab without downloading a file,
	the same distinction the old client-side jsPDF View/Download buttons
	made, now made server-side since the PDF itself is generated there."""
	frappe.local.response.filename = filename
	frappe.local.response.filecontent = pdf_bytes
	frappe.local.response.type = "download" if frappe.utils.sbool(as_attachment) else "pdf"


GENERIC_REPORT_PDF_OPTIONS = {
    "page-size": "A4", "orientation": "Portrait",
    "margin-top": "10mm", "margin-bottom": "16mm", "margin-left": "12mm", "margin-right": "12mm",
    # Page numbering (README's "known minor gap" / edupro-devops skill's
    # print_reports gotcha 3): "Page [page] of [topage]" produced a blank
    # trailing page even after the bare-<p>-margin fix that resolved the
    # otherwise-identical gotcha 2 symptom -- this was a real, already-
    # investigated failure, not an untried idea. [topage] is the one part
    # of that combination not tried in isolation: it's the one placeholder
    # that forces wkhtmltopdf into a second render pass (to know the total
    # page count) before laying out the real content, a structurally
    # different code path from [page] alone (computable in a single
    # streaming pass). This sets [page] only -- a genuinely narrower,
    # untried case, not a retry of what already failed -- plus a larger
    # margin-bottom and explicit footer-spacing so the native footer gets
    # real reserved space instead of fighting print_footer.html's own
    # in-flow footer for the same margin. Still NOT re-verified live: no
    # bench was available in this environment. Generate Outstanding Fees
    # (~69 pages on production data) as a real PDF and check for a stray
    # blank page before trusting this. Upgrading to "of [topage]" is a
    # further follow-up, only once this narrower case is confirmed safe.
    "footer-right": "Page [page]", "footer-font-size": "7", "footer-spacing": "4",
}

# report_key -> a function taking **kwargs (the same query params the
# whitelisted method received) and returning a GenericReportContext.
_REPORT_BUILDERS = {
    "daily-cash-collection": lambda **kw: build_daily_cash_collection_context(kw.get("collection_date")),
    "payment-summary": lambda **kw: build_payment_summary_context(kw["from_date"], kw["to_date"]),
    "outstanding-fees": lambda **kw: build_outstanding_fees_context(kw.get("academic_year"), kw.get("grade"), kw.get("threshold")),
    "income-expenditure": lambda **kw: build_income_expenditure_context(kw["from_date"], kw["to_date"]),
    "financial-position": lambda **kw: build_financial_position_context(kw.get("as_of_date")),
    "cashbook": lambda **kw: build_cashbook_context(kw.get("account"), kw["from_date"], kw["to_date"]),
    "receipts-and-payments": lambda **kw: build_receipts_and_payments_context(kw["from_date"], kw["to_date"]),
    "trial-balance": lambda **kw: build_trial_balance_context(kw.get("as_of_date")),
    "fixed-assets-register": lambda **kw: build_fixed_assets_register_context(),
    "termly-fee-collection": lambda **kw: build_class_level_fee_summary_context(kw["academic_year"]),
    "bank-reconciliation": lambda **kw: build_bank_reconciliation_context(kw.get("bank_account"), kw.get("from_date"), kw.get("to_date")),
    "budget-variance": lambda **kw: build_budget_variance_context(kw.get("budget_vote_book")),
    "beam-reconciliation": lambda **kw: build_beam_reconciliation_context(kw.get("term")),
    "class-list": lambda **kw: build_class_list_context(kw["grade"]),
}


@frappe.whitelist()
def generate_receipt_pdf(receipt: str, is_reprint: bool = False, as_attachment: bool = True):
    """Streams the official A5 receipt PDF for a submitted Receipt.
    Permission is enforced by get_receipt_context() via frappe.has_permission
    on the Receipt itself -- no separate role check invented here."""
    doc = frappe.get_doc("Receipt", receipt)
    if doc.docstatus != 1:
        frappe.throw("Only a submitted receipt can be printed.")

    context, qr_data_uri = get_receipt_context(receipt)
    branding = get_school_branding()

    html_context = {
        "receipt": context,
        "branding": branding,
        "qr_data_uri": qr_data_uri,
        "is_reprint": frappe.utils.sbool(is_reprint),
        "is_sample": False,
        "generated_on": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "doc_title": "Official Receipt",
        "doc_meta": [
            ("Receipt No.", context.name),
            ("Date", frappe.utils.formatdate(doc.posting_date)),
            ("Status", context.status),
        ],
    }

    pdf_bytes = generate_pdf("financial/receipt.html", html_context, wkhtmltopdf_options=RECEIPT_PDF_OPTIONS)
    _set_pdf_response(f"{context.name}.pdf", pdf_bytes, as_attachment)


@frappe.whitelist()
def generate_financial_report_pdf(report_key: str, as_attachment: bool = True, **kwargs):
    """One dispatcher for every tabular report (Daily Cash Collection,
    Payment Summary, Outstanding Fees, Income & Expenditure, Financial
    Position, Cashbook, Receipts & Payments, Ledger, Fixed Assets Register,
    Termly Fee Collection) -- each builder function only reshapes an
    existing reports.py/statutory_reports_extra.py whitelisted function's
    output, so permission enforcement (_require_internal_role) already
    happens inside that underlying function; nothing extra is checked here."""
    builder = _REPORT_BUILDERS.get(report_key)
    if not builder:
        frappe.throw(f"Unknown report: {report_key}")

    report = builder(**kwargs)
    branding = get_school_branding()
    html_context = {
        "report": report,
        "branding": branding,
        "is_sample": False,
        "generated_on": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "doc_title": report.title,
        "doc_meta": report.doc_meta,
    }

    pdf_bytes = generate_pdf("financial/generic_report.html", html_context, wkhtmltopdf_options=GENERIC_REPORT_PDF_OPTIONS)
    _set_pdf_response(f"{report_key}.pdf", pdf_bytes, as_attachment)


@frappe.whitelist()
def generate_student_statement_pdf(student: str, as_attachment: bool = True):
    """Permission is enforced by build_student_statement_context() via
    frappe.has_permission on the Student itself."""
    statement = build_student_statement_context(student)
    branding = get_school_branding()
    html_context = {
        "statement": statement,
        "branding": branding,
        "is_sample": False,
        "generated_on": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "doc_title": "Student Fee Statement",
        "doc_meta": [("Student", statement.student_name), ("Student ID", statement.student)],
    }

    pdf_bytes = generate_pdf("financial/student_statement.html", html_context, wkhtmltopdf_options=GENERIC_REPORT_PDF_OPTIONS)
    _set_pdf_response(f"statement-{statement.student}.pdf", pdf_bytes, as_attachment)


@frappe.whitelist()
def generate_ed46_return_pdf(name: str, as_attachment: bool = True):
    """A fixed-layout regulatory form, not a tabular report -- its own
    template (financial/ed46_return.html), not generic_report.html.
    Permission is enforced by build_ed46_return_context() via
    frappe.has_permission on the MoPSE ED46 Return itself."""
    ed46 = build_ed46_return_context(name)
    branding = get_school_branding()
    html_context = {
        "ed46": ed46,
        "branding": branding,
        "is_sample": False,
        "generated_on": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "doc_title": "MoPSE ED46 Return",
        "doc_meta": [("Term", ed46.term), ("Status", ed46.workflow_state)],
    }

    pdf_bytes = generate_pdf("financial/ed46_return.html", html_context, wkhtmltopdf_options=GENERIC_REPORT_PDF_OPTIONS)
    _set_pdf_response(f"{ed46.name}.pdf", pdf_bytes, as_attachment)
