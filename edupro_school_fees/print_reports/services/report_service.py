"""FinancialReportService -- assembles typed, template-ready context from
the app's existing doctypes and helper functions. Never recomputes a
financial figure a doctype or notifications.py helper already owns
(_outstanding_balance, _guardian_for_student) -- this module only shapes
that same data for print, it never derives a second version of it."""

import base64
from io import BytesIO
from urllib.parse import quote

import frappe
from frappe.utils import get_url

from edupro_school_fees.notifications import _guardian_for_student, _outstanding_balance
from edupro_school_fees.print_reports.schemas.financial_reports import (
    Ed46ReturnContext,
    GenericReportContext,
    ReceiptAllocationLine,
    ReceiptContext,
    ReportTableSection,
    StudentStatementContext,
)

_PAYER_NAME_FIELD = {"Parent Guardian": "full_name", "Sponsor": "sponsor_name"}


def _payer_display_name(receipt):
    if receipt.payer and receipt.payer_type in _PAYER_NAME_FIELD:
        try:
            return frappe.db.get_value(receipt.payer_type, receipt.payer, _PAYER_NAME_FIELD[receipt.payer_type])
        except Exception:
            return receipt.payer
    guardian = _guardian_for_student(receipt.student)
    return guardian.full_name if guardian else None


def _amount_display(amount, currency):
    return f"{currency} {amount:,.2f}" if currency == "ZiG" else f"${amount:,.2f}"


def _qr_data_uri(receipt_name: str, integrity_hash: str) -> str | None:
    """Same verification link the client-side receipt PDF already encodes
    (edupro-theme/src/lib/export.ts's verificationUrl) -- scanning either
    one leads to the same public verify_receipt() check.

    Carries the receipt's own integrity_hash as `token` -- verify_receipt()
    now requires it to match before returning anything, closing the
    unauthenticated-enumeration gap a bare ?receipt=<name> link left open
    (sequential IDs, no rate limit, full name+amount+date harvestable)."""
    try:
        import qrcode
    except ImportError:
        frappe.log_error(title="print_reports: qrcode package not installed, skipping QR code")
        return None

    url = f"{get_url()}/verify-receipt?receipt={quote(receipt_name)}&token={quote(integrity_hash or '')}"
    img = qrcode.make(url)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


def get_receipt_context(receipt_name: str) -> tuple[ReceiptContext, str | None]:
    """Returns (context, qr_data_uri). Raises frappe.PermissionError if the
    caller can't read this Receipt -- the same permission model every other
    Receipt view already enforces, not a new one invented for printing."""
    receipt = frappe.get_doc("Receipt", receipt_name)
    if not frappe.has_permission(doc=receipt, ptype="read"):
        frappe.throw("Not permitted to view this receipt.", frappe.PermissionError)

    first, last = frappe.db.get_value("Student", receipt.student, ["first_name", "last_name"])
    student_name = " ".join(p for p in (first, last) if p) or receipt.student
    grade = frappe.db.get_value("Student", receipt.student, "grade")
    received_by_name = frappe.db.get_value("User", receipt.received_by, "full_name") or receipt.received_by

    allocations = [
        ReceiptAllocationLine(
            description=frappe.db.get_value("Fee Item", line.fee_item, "item_name") or line.fee_item,
            amount_display=_amount_display(line.amount, receipt.currency),
        )
        for line in receipt.allocations
    ]

    context = ReceiptContext(
        name=receipt.name,
        student=receipt.student,
        student_name=student_name,
        grade=grade,
        payer_name=_payer_display_name(receipt),
        payment_method=receipt.payment_method,
        external_reference=receipt.external_reference,
        received_by_name=received_by_name,
        amount_display=_amount_display(receipt.amount, receipt.currency),
        outstanding_balance_display=f"${_outstanding_balance(receipt.student):,.2f}",
        status=receipt.status,
        allocations=allocations,
    )
    return context, _qr_data_uri(receipt.name, receipt.integrity_hash)


# ---------------------------------------------------------------------------
# Generic tabular reports -- each function below only reshapes an existing
# reports.py/statutory_reports_extra.py whitelisted function's output into
# GenericReportContext; none of them recompute a figure. Amount formatting
# happens once, here, server-side -- the same figures the frontend already
# shows, never a second calculation of them.
# ---------------------------------------------------------------------------

def _usd(amount) -> str:
    return f"${amount:,.2f}"


def build_daily_cash_collection_context(collection_date: str) -> GenericReportContext:
    from edupro_school_fees.reports import get_daily_cash_collection

    data = get_daily_cash_collection(collection_date)
    rows = [
        [
            l["receipt_no"], str(l["posting_date"]), f"{l['first_name']} {l['last_name']}".strip(), l["student"],
            l["payment_method"] or "Unspecified", l["currency"], f"{l['amount']:,.2f}", _usd(l["amount_usd"]),
        ]
        for l in data["lines"]
    ]
    by_method_cards = [(method, _usd(amount)) for method, amount in sorted(data["by_payment_method"].items(), key=lambda kv: -kv[1])]

    return GenericReportContext(
        title="Daily Cash Collection Report",
        period_label=data["collection_date"],
        doc_meta=[("Date", data["collection_date"]), ("Transactions", str(len(data["lines"])))],
        summary_cards=[("Grand Total (USD)", _usd(data["grand_total_usd"])), *by_method_cards],
        tables=[ReportTableSection(
            heading="Receipts",
            columns=["Receipt No.", "Date", "Student", "Student ID", "Payment Method", "Currency", "Amount (native)", "Amount (USD)"],
            rows=rows, num_col_indexes=[6, 7],
            totals_row=["", "", "", "", "", "", "Grand Total", _usd(data["grand_total_usd"])],
        )],
        notes=["Cash-basis: every submitted Receipt posted on this date, regardless of which invoice or term it settles."],
    )


def build_payment_summary_context(from_date: str, to_date: str) -> GenericReportContext:
    from edupro_school_fees.reports import get_payment_summary

    data = get_payment_summary(from_date, to_date)
    rows = [[l["payment_method"], l["currency"], str(l["transaction_count"]), f"{l['total_amount']:,.2f}"] for l in data["lines"]]

    return GenericReportContext(
        title="Payment Summary Report",
        period_label=f"{data['from_date']} to {data['to_date']}",
        doc_meta=[("From", data["from_date"]), ("To", data["to_date"])],
        summary_cards=[("Total Transactions", str(data["total_transactions"])), ("Total Collected (USD)", _usd(data["total_collected_usd"]))],
        tables=[ReportTableSection(
            heading="By Payment Method",
            columns=["Payment Method", "Currency", "Transactions", "Total Amount (native)"],
            rows=rows, num_col_indexes=[2, 3],
        )],
        notes=["Cash-basis: every submitted Receipt in the period, grouped by its configured Payment Method."],
    )


def build_outstanding_fees_context(academic_year: str | None = None, grade: str | None = None, threshold: float | None = None) -> GenericReportContext:
    from edupro_school_fees.reports import get_outstanding_fees_report

    data = get_outstanding_fees_report(academic_year, grade, threshold)
    rows = [
        [
            f"{r['first_name']} {r['last_name']}".strip(), r["student"], r["grade"] or "Ungraded",
            r.get("guardian_name") or "", _usd(r["total_invoiced"]), _usd(r["total_paid"]),
            _usd(r["outstanding_amount"]), str(r["last_payment_date"]) if r["last_payment_date"] else "Never",
        ]
        for r in data["rows"]
    ]
    by_grade_cards = [(grade_key, _usd(amount)) for grade_key, amount in sorted(data["by_grade"].items(), key=lambda kv: -kv[1])]

    return GenericReportContext(
        title="Outstanding Fees Report",
        period_label=f"Academic Year: {data['academic_year'] or 'All'}" + (f" · Grade: {data['grade']}" if data["grade"] else ""),
        doc_meta=[("Students with balance", str(data["student_count"])), ("Total Outstanding (USD)", _usd(data["total_outstanding"]))],
        summary_cards=[("Students Outstanding", str(data["student_count"])), ("Total Outstanding (USD)", _usd(data["total_outstanding"])), *by_grade_cards],
        tables=[ReportTableSection(
            heading="Students with an Outstanding Balance",
            columns=["Student", "Student ID", "Grade", "Guardian", "Total Invoiced", "Total Paid", "Outstanding", "Last Payment"],
            rows=rows, num_col_indexes=[4, 5, 6],
            totals_row=["", "", "", "Total", "", "", _usd(data["total_outstanding"]), ""],
        )],
        notes=["Every student with at least one submitted Invoice whose outstanding_amount is greater than zero -- broader than the Debtor Case dashboard, which only covers cases already escalated."],
    )


def build_class_list_context(grade: str) -> GenericReportContext:
    """A plain register/roster for one class (grade/stream) -- name and
    MoPSE admission number only, sorted alphabetically for a Bursar to take
    attendance or hand to a teacher. Active students only; a withdrawn or
    graduated student has no business on a current class list."""
    from edupro_school_fees.reports import _log_report_generated, _require_internal_role

    _require_internal_role()
    if not grade:
        frappe.throw("Grade is required.")
    _log_report_generated("Class List", f" ({grade})")

    students = frappe.get_all(
        "Student",
        filters={"grade": grade, "status": "Active"},
        fields=["first_name", "last_name", "mopse_admission_number"],
        order_by="last_name asc, first_name asc",
    )
    rows = [
        [f"{s.first_name} {s.last_name}".strip(), s.mopse_admission_number or ""]
        for s in students
    ]

    return GenericReportContext(
        title=f"Class List - {grade}",
        period_label=grade,
        doc_meta=[("Class", grade), ("Students", str(len(rows)))],
        summary_cards=[("Total Students", str(len(rows)))],
        tables=[ReportTableSection(
            heading=f"{grade} - Active Students",
            columns=["Student Name", "Admission Number"],
            rows=rows,
        )],
    )


def build_income_expenditure_context(from_date: str, to_date: str) -> GenericReportContext:
    from edupro_school_fees.reports import get_comprehensive_income

    data = get_comprehensive_income(from_date, to_date)
    income_rows = [[l["account"], l["fund"] or "", _usd(l["amount"])] for l in data["income_lines"]]
    expense_rows = [[l["account"], l["fund"] or "", _usd(l["amount"])] for l in data["expense_lines"]]

    return GenericReportContext(
        title="Income and Expenditure Statement",
        period_label=f"{data['from_date']} to {data['to_date']} (accrual basis)",
        doc_meta=[("From", data["from_date"]), ("To", data["to_date"]), ("Basis", "Accrual")],
        summary_cards=[
            ("Total Income", _usd(data["total_income"])), ("Total Expenditure", _usd(data["total_expense"])),
            ("Surplus / (Deficit)", _usd(data["surplus_deficit"])),
        ],
        tables=[
            ReportTableSection(heading="Income", columns=["Account", "Fund", "Amount"], rows=income_rows, num_col_indexes=[2],
                                totals_row=["Total Income", "", _usd(data["total_income"])]),
            ReportTableSection(heading="Expenditure", columns=["Account", "Fund", "Amount"], rows=expense_rows, num_col_indexes=[2],
                                totals_row=["Total Expenditure", "", _usd(data["total_expense"])]),
        ],
        notes=["Prepared on an accrual basis (income/expense recognized when the Journal Entry is posted, not when cash moves) -- this is a Statement of Comprehensive Income, not a cash-flow statement. See the Bursar Cashbook / Receipts & Payments reports for the cash-basis view."],
    )


def build_financial_position_context(as_of_date: str) -> GenericReportContext:
    from edupro_school_fees.reports import get_financial_position

    data = get_financial_position(as_of_date)
    asset_rows = [[l["account"], l["fund"] or "", _usd(l["amount"])] for l in data["asset_lines"]]
    liability_rows = [[l["account"], l["fund"] or "", _usd(l["amount"])] for l in data["liability_lines"]]
    equity_rows = [[l["account"], l["fund"] or "", _usd(l["amount"])] for l in data["equity_lines"]]

    notes = ["Cumulative from inception to the as-at date -- a balance sheet is a snapshot, not a flow for a period."]
    if not data["is_balanced"]:
        notes.append(f"DISCREPANCY: Assets do not equal Liabilities + Accumulated Funds by {_usd(abs(data['imbalance_amount']))} -- this report shows the underlying ledger figures as they are, not a plug that would hide it.")

    return GenericReportContext(
        title="Statement of Financial Position",
        period_label=f"As at {data['as_of_date']}",
        doc_meta=[("As at", data["as_of_date"]), ("Balanced", "Yes" if data["is_balanced"] else "No -- see note below")],
        summary_cards=[
            ("Total Assets", _usd(data["total_assets"])), ("Total Liabilities", _usd(data["total_liabilities"])),
            ("Accumulated Funds", _usd(data["accumulated_funds"])),
        ],
        tables=[
            ReportTableSection(heading="Assets", columns=["Account", "Fund", "Amount"], rows=asset_rows, num_col_indexes=[2],
                                totals_row=["Total Assets", "", _usd(data["total_assets"])]),
            ReportTableSection(heading="Liabilities", columns=["Account", "Fund", "Amount"], rows=liability_rows, num_col_indexes=[2],
                                totals_row=["Total Liabilities", "", _usd(data["total_liabilities"])]),
            ReportTableSection(heading="Equity", columns=["Account", "Fund", "Amount"], rows=equity_rows, num_col_indexes=[2],
                                totals_row=["Accumulated Funds", "", _usd(data["accumulated_funds"])]),
        ],
        notes=notes,
    )


def build_cashbook_context(account: str | None, from_date: str, to_date: str) -> GenericReportContext:
    from edupro_school_fees.reports import get_cash_book

    data = get_cash_book(account, from_date, to_date)
    rows = [[l["posting_date"], l["voucher_no"], l["reference_doctype"] or "", l["description"] or "",
             f"{l['debit']:,.2f}" if l["debit"] else "", f"{l['credit']:,.2f}" if l["credit"] else "", f"{l['balance']:,.2f}"]
            for l in data["lines"]]

    return GenericReportContext(
        title="Bursar Cashbook",
        period_label=f"{data['account'] or 'No cash/bank account configured'} · {data['from_date']} to {data['to_date']}",
        doc_meta=[("Account", data["account"] or "-"), ("From", data["from_date"]), ("To", data["to_date"])],
        summary_cards=[("Opening Balance", _usd(data["opening_balance"])), ("Closing Balance", _usd(data["closing_balance"]))],
        tables=[ReportTableSection(
            heading="Transactions",
            columns=["Date", "Voucher", "Source", "Description", "Debit", "Credit", "Balance"],
            rows=rows, num_col_indexes=[4, 5, 6],
        )],
        notes=["Cash-basis running balance. Figures are normalized into this system's base currency (ZiG) at each transaction's own recorded exchange rate; the summary cards above convert to USD for display only."],
    )


def build_receipts_and_payments_context(from_date: str, to_date: str) -> GenericReportContext:
    from edupro_school_fees.reports import get_receipts_and_payments

    data = get_receipts_and_payments(from_date, to_date)
    receipt_rows = [[l["source"], _usd(l["amount"])] for l in data["receipt_lines"]]
    payment_rows = [[l["source"], _usd(l["amount"])] for l in data["payment_lines"]]

    return GenericReportContext(
        title="Statement of Receipts and Payments",
        period_label=f"{data['from_date']} to {data['to_date']} (cash basis)",
        doc_meta=[("From", data["from_date"]), ("To", data["to_date"]), ("Basis", "Cash")],
        summary_cards=[
            ("Total Receipts", _usd(data["total_receipts"])), ("Total Payments", _usd(data["total_payments"])),
            ("Net Movement", _usd(data["net_movement"])),
        ],
        tables=[
            ReportTableSection(heading="Receipts", columns=["Source", "Amount"], rows=receipt_rows, num_col_indexes=[1],
                                totals_row=["Total Receipts", _usd(data["total_receipts"])]),
            ReportTableSection(heading="Payments", columns=["Source", "Amount"], rows=payment_rows, num_col_indexes=[1],
                                totals_row=["Total Payments", _usd(data["total_payments"])]),
        ],
        notes=["Cash-basis: any submitted Journal Entry touching a Cash-in-Till or Bank account, grouped by what produced it."],
    )


def build_trial_balance_context(as_of_date: str) -> GenericReportContext:
    from edupro_school_fees.statutory_reports_extra import get_multi_currency_trial_balance

    data = get_multi_currency_trial_balance(as_of_date)
    rows = [
        [l["account"], l["account_type"], l["currency"], f"{l['native_debit']:,.2f}", f"{l['native_credit']:,.2f}",
         _usd(l["usd_debit"] or 0), _usd(l["usd_credit"] or 0)]
        for l in data["lines"]
    ]

    return GenericReportContext(
        title="Ledger (Trial Balance)",
        period_label=f"As at {data['as_of_date']}",
        doc_meta=[("As at", data["as_of_date"]), ("Accounts with activity", str(len(data["lines"])))],
        tables=[ReportTableSection(
            columns=["Account", "Type", "Currency", "Debit (native)", "Credit (native)", "Debit (USD)", "Credit (USD)"],
            rows=rows, num_col_indexes=[3, 4, 5, 6],
            totals_row=["Total (USD)", "", "", "", "", _usd(data["total_usd_debit"] or 0), _usd(data["total_usd_credit"] or 0)],
        )],
        notes=["Per-account debit/credit, in each account's own currency and normalized to USD."],
    )


def build_fixed_assets_register_context() -> GenericReportContext:
    from edupro_school_fees.statutory_reports_extra import get_fixed_assets_disposal_register

    data = get_fixed_assets_disposal_register()

    def _asset_row(a):
        return [a["asset_code"], a["description"], a["date_acquired"], f"{a['historical_cost']:,.2f} {a['currency']}",
                f"{a['accumulated_depreciation']:,.2f}", f"{a['net_book_value']:,.2f}", a["disposal_status"]]

    return GenericReportContext(
        title="Fixed Assets Register",
        period_label="As at today",
        doc_meta=[("Total assets", str(data["total_assets"])), ("In use", str(data["total_in_use"])), ("Disposed", str(data["total_disposed"]))],
        summary_cards=[
            ("Historical Cost", _usd(data["total_historical_cost"])), ("Accumulated Depreciation", _usd(data["total_accumulated_depreciation"])),
            ("Net Book Value", _usd(data["total_net_book_value"])),
        ],
        tables=[ReportTableSection(
            columns=["Asset Code", "Description", "Acquired", "Historical Cost", "Accum. Depreciation", "Net Book Value", "Status"],
            rows=[_asset_row(a) for a in data["assets"]], num_col_indexes=[3, 4, 5],
        )],
    )


def build_class_level_fee_summary_context(academic_year: str) -> GenericReportContext:
    from edupro_school_fees.statutory_reports_extra import get_class_level_fee_summary

    data = get_class_level_fee_summary(academic_year)
    rows = [[r["grade"], str(r["invoice_count"]), _usd(r["total_billed"]), _usd(r["total_collected"]), _usd(r["total_outstanding"])] for r in data["rows"]]
    total_billed = sum(r["total_billed"] for r in data["rows"])
    total_collected = sum(r["total_collected"] for r in data["rows"])
    total_outstanding = sum(r["total_outstanding"] for r in data["rows"])
    collection_pct = (total_collected / total_billed * 100) if total_billed else 0.0

    return GenericReportContext(
        title="Termly Fee Collection Report",
        period_label=f"Academic Year {data['academic_year']}",
        doc_meta=[("Academic Year", data["academic_year"])],
        summary_cards=[
            ("Total Billed", _usd(total_billed)), ("Total Collected", _usd(total_collected)),
            ("Outstanding", _usd(total_outstanding)), ("Collection Rate", f"{collection_pct:.1f}%"),
        ],
        tables=[ReportTableSection(
            heading="By Grade",
            columns=["Grade", "Invoices", "Total Billed", "Total Collected", "Outstanding"],
            rows=rows, num_col_indexes=[2, 3, 4],
            totals_row=["Total", "", _usd(total_billed), _usd(total_collected), _usd(total_outstanding)],
        )],
        notes=["Scoped to an academic year, not a single term -- Invoice does not carry a separate term field to break this down further." if rows else ""],
    )


def build_student_statement_context(student: str) -> StudentStatementContext:
    """Server-side equivalent of edupro-theme's buildStatementSections --
    same Invoice/Receipt data, same "positive balance = owed to school"
    convention, reshaped for this print engine instead of duplicating the
    balance math a second way."""
    if not frappe.has_permission("Student", "read", student):
        frappe.throw("Not permitted to view this student.", frappe.PermissionError)

    first, last = frappe.db.get_value("Student", student, ["first_name", "last_name"])
    student_name = " ".join(p for p in (first, last) if p) or student
    grade = frappe.db.get_value("Student", student, "grade")
    guardian = _guardian_for_student(student)

    # Excludes Consolidated invoices: an invoice absorbed into a later one via
    # _carry_forward_prior_balances() has its full total re-stated as a
    # "Balance brought forward" line on that later invoice, so summing every
    # invoice's total_amount here would double/triple-count the same debt.
    invoices = frappe.get_all(
        "Invoice", filters={"student": student, "docstatus": 1, "status": ["!=", "Consolidated"]},
        fields=["name", "posting_date", "total_amount", "outstanding_amount"], order_by="posting_date",
    )
    receipts = frappe.get_all(
        "Receipt", filters={"student": student, "docstatus": 1, "status": "Submitted"},
        fields=["name", "posting_date", "amount", "currency"], order_by="posting_date",
    )

    events = [{"date": i.posting_date, "ref": i.name, "desc": "Invoice raised", "debit": i.total_amount, "credit": 0} for i in invoices]
    events += [{"date": r.posting_date, "ref": r.name, "desc": "Payment received", "debit": 0,
                "credit": r.amount if r.currency == "USD" else 0} for r in receipts]
    events.sort(key=lambda e: e["date"])

    balance = 0.0
    transactions = []
    for e in events:
        balance = balance + e["debit"] - e["credit"]
        transactions.append([str(e["date"]), e["ref"], e["desc"], _usd(e["debit"]) if e["debit"] else "", _usd(e["credit"]) if e["credit"] else "", _usd(balance)])

    total_invoiced = sum(i.total_amount for i in invoices)
    total_paid = sum(r.amount for r in receipts if r.currency == "USD")
    outstanding = _outstanding_balance(student)

    from edupro_school_fees.utils import _school_setup_name

    banking_details = []
    school_setup = _school_setup_name()
    if school_setup:
        rows = frappe.get_all(
            "School Banking Configuration", filters={"parent": school_setup, "is_active": 1},
            fields=["bank_name", "fee_stream", "account_name", "account_number", "currency_type"],
        )
        banking_details = [[r.bank_name, r.fee_stream, r.account_name, r.account_number, r.currency_type] for r in rows]

    return StudentStatementContext(
        student=student,
        student_name=student_name,
        grade=grade,
        guardian_name=guardian.full_name if guardian else None,
        opening_balance_display=_usd(0),
        total_invoiced_display=_usd(total_invoiced),
        total_paid_display=_usd(total_paid),
        outstanding_balance_display=_usd(outstanding),
        transactions=transactions,
        banking_details=banking_details,
    )


# ---------------------------------------------------------------------------
# Bank Reconciliation, Budget Variance, BEAM Reconciliation, MoPSE ED46 --
# the four reports print_reports' README listed as "not yet built" because
# they had no existing reports.py aggregation to reuse. Bank Reconciliation
# and Budget Variance read their doctypes directly (there's nothing to
# reuse); BEAM Reconciliation reuses beam_claim.py's own
# get_beam_reconciliation() rather than re-deriving its unpaid-claim math a
# second way; ED46 reads the doctype directly since it's already a
# per-record snapshot, not an aggregation.
# ---------------------------------------------------------------------------

def _account_currency_map() -> dict:
    return {a.name: a.currency for a in frappe.get_all("Account", fields=["name", "currency"])}


def _to_usd(amount, currency: str, as_of_date: str | None = None) -> float:
    """Same convention as every other USD figure in this app (reports.py's
    _usd_equivalent, edupro-theme's zigToUsd): native-currency accounts
    convert through the recorded Exchange Rate; a USD account passes
    through unchanged. Deliberately does NOT catch a missing-rate error the
    way _usd_equivalent does -- that helper's USD figure is an optional
    secondary line the frontend can hide; here the USD figure *is* the
    report, so a missing rate should fail loudly rather than print a wrong
    or blank number on an official document."""
    if currency == "USD":
        return float(amount)

    from edupro_school_fees.utils import convert_amount, get_exchange_rate

    rate = get_exchange_rate(currency, "USD", as_of_date)
    return convert_amount(amount, currency, "USD", rate)


def build_bank_reconciliation_context(bank_account: str | None = None, from_date: str | None = None, to_date: str | None = None) -> GenericReportContext:
    from edupro_school_fees.reports import _log_report_generated, _require_internal_role

    _require_internal_role()
    _log_report_generated("Bank Reconciliation Report")

    filters = {}
    if bank_account:
        filters["bank_account"] = bank_account
    if from_date and to_date:
        filters["period_end"] = ["between", [from_date, to_date]]
    elif from_date:
        filters["period_end"] = [">=", from_date]
    elif to_date:
        filters["period_end"] = ["<=", to_date]

    reconciliations = frappe.get_all(
        "Bank Reconciliation", filters=filters,
        fields=["name", "bank_account", "period_end", "balance_per_statement", "balance_per_cashbook", "reconciled_balance", "variance", "workflow_state"],
        order_by="period_end desc",
    )
    currency_by_account = _account_currency_map()

    rows = []
    total_variance = 0.0
    for r in reconciliations:
        currency = currency_by_account.get(r.bank_account, "USD")
        variance_usd = _to_usd(r.variance, currency, r.period_end)
        total_variance += variance_usd
        rows.append([
            r.bank_account, str(r.period_end),
            _usd(_to_usd(r.balance_per_statement, currency, r.period_end)),
            _usd(_to_usd(r.balance_per_cashbook, currency, r.period_end)),
            _usd(_to_usd(r.reconciled_balance, currency, r.period_end)),
            _usd(variance_usd),
            r.workflow_state,
        ])

    return GenericReportContext(
        title="Bank Reconciliation Report",
        period_label=f"{from_date or 'All'} to {to_date or 'today'}" if (from_date or to_date) else "All periods on record",
        doc_meta=[("Accounts reconciled", str(len({r.bank_account for r in reconciliations}))), ("Reconciliations", str(len(reconciliations)))],
        summary_cards=[("Total Variance (USD)", _usd(total_variance))],
        tables=[ReportTableSection(
            columns=["Bank Account", "Period End", "Statement Balance", "Cashbook Balance", "Reconciled Balance", "Variance", "Status"],
            rows=rows, num_col_indexes=[2, 3, 4, 5],
        )],
        notes=["Each reconciliation's own native-currency figures, converted to USD at the exchange rate in force on its period end."],
    )


def build_budget_variance_context(budget_vote_book: str | None = None) -> GenericReportContext:
    from edupro_school_fees.reports import _log_report_generated, _require_internal_role

    _require_internal_role()
    _log_report_generated("Budget Vote Book Variance Report")

    filters = {"budget_vote_book": budget_vote_book} if budget_vote_book else {}
    lines = frappe.get_all(
        "Budget Line", filters=filters,
        fields=["name", "fund", "vote_code", "description", "expense_account", "approved_budget", "committed_amount", "actual_spend"],
        order_by="fund asc, vote_code asc",
    )
    currency_by_account = _account_currency_map()

    def usd_for(line, field):
        return _to_usd(line[field], currency_by_account.get(line.expense_account, "USD"))

    rows = []
    total_approved = total_actual = 0.0
    for line in lines:
        approved = usd_for(line, "approved_budget")
        committed = usd_for(line, "committed_amount")
        spent = usd_for(line, "actual_spend")
        actual = committed + spent
        variance = approved - actual
        total_approved += approved
        total_actual += actual
        rows.append([line.fund, line.vote_code, line.description, _usd(approved), _usd(committed), _usd(spent), _usd(variance)])

    return GenericReportContext(
        title="Budget Vote Book Variance Report",
        period_label=budget_vote_book or "All active budget lines",
        doc_meta=[("Budget Vote Book", budget_vote_book or "All"), ("Budget lines", str(len(lines)))],
        summary_cards=[
            ("Total Approved (USD)", _usd(total_approved)), ("Total Actual (USD)", _usd(total_actual)),
            ("Variance (USD)", _usd(total_approved - total_actual)),
        ],
        tables=[ReportTableSection(
            columns=["Fund", "Vote Code", "Description", "Approved Budget", "Committed", "Actual Spend", "Variance"],
            rows=rows, num_col_indexes=[3, 4, 5, 6],
            totals_row=["", "", "Total", _usd(total_approved), "", "", _usd(total_approved - total_actual)],
        )],
        notes=["Variance = Approved Budget − (Committed + Actual Spend). A positive variance is favorable (under budget)."],
    )


def build_beam_reconciliation_context(term: str | None = None) -> GenericReportContext:
    from edupro_school_fees.edupro_school_fees.doctype.beam_claim.beam_claim import get_beam_reconciliation

    data = get_beam_reconciliation(term)
    rows = [
        [r["student_name"], r["student"], r["grade"] or "Ungraded", r["term"], str(r["claim_date"]),
         _usd(r["tuition_arrears_claimed"]), _usd(r["sdc_levy_arrears_claimed"]), _usd(r["treasury_amount_disbursed"]), _usd(r["unpaid_claim"])]
        for r in data["rows"]
    ]

    return GenericReportContext(
        title="BEAM Reconciliation Report",
        period_label=f"Term: {term}" if term else "All terms",
        doc_meta=[("Term", term or "All"), ("Claims", str(len(data["rows"])))],
        summary_cards=[
            ("Tuition Claimed", _usd(data["totals"]["total_tuition_claimed"])),
            ("SDC Levy Claimed", _usd(data["totals"]["total_sdc_levy_claimed"])),
            ("Disbursed", _usd(data["totals"]["total_disbursed"])),
            ("Unpaid", _usd(data["totals"]["total_unpaid"])),
        ],
        tables=[ReportTableSection(
            columns=["Student", "Student ID", "Grade", "Term", "Claim Date", "Tuition Claimed", "SDC Levy Claimed", "Treasury Disbursed", "Unpaid"],
            rows=rows, num_col_indexes=[5, 6, 7, 8],
            totals_row=["", "", "", "", "Total", _usd(data["totals"]["total_tuition_claimed"]), _usd(data["totals"]["total_sdc_levy_claimed"]),
                        _usd(data["totals"]["total_disbursed"]), _usd(data["totals"]["total_unpaid"])],
        )],
        notes=["Matches Treasury disbursements (cumulative, per student) against tuition and SDC levy arrears claimed under the Basic Education Assistance Module."],
    )


def build_ed46_return_context(name: str) -> Ed46ReturnContext:
    doc = frappe.get_doc("MoPSE ED46 Return", name)
    if not frappe.has_permission(doc=doc, ptype="read"):
        frappe.throw("Not permitted to view this ED46 return.", frappe.PermissionError)

    return Ed46ReturnContext(
        name=doc.name,
        term=doc.term,
        school_name=doc.school_name,
        registration_number=doc.registration_number,
        emis_number=doc.emis_number,
        school_code=doc.school_code,
        physical_address=doc.physical_address,
        district=doc.district,
        region=doc.region,
        total_enrolment=doc.total_enrolment or 0,
        levy_base_amount_display=_usd(doc.levy_base_amount or 0),
        total_revenue_billed_display=_usd(doc.total_revenue_billed or 0),
        total_revenue_realized_display=_usd(doc.total_revenue_realized or 0),
        workflow_state=doc.workflow_state,
        bursar_certified=bool(doc.bursar_certified),
        school_head_certified=bool(doc.school_head_certified),
        sdc_certified=bool(doc.sdc_certified),
        staffing_support_analysis=doc.staffing_support_analysis,
        certified_on_display=frappe.utils.format_datetime(doc.certified_on) if doc.certified_on else None,
    )
