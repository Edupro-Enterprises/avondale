"""Typed context objects for the print_reports templates. Jinja2 reads
dataclass attributes the same way it reads dict keys (`receipt.student_name`
works either way), so these exist purely so report_service.py can't
accidentally hand a template a typo'd or missing field -- dataclasses fail
at construction time, a plain dict wouldn't."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SchoolBranding:
    """Mirrors the real fields on School Setup (see notifications.py's
    _school_letterhead()) -- deliberately has no motto/website field,
    because School Setup doesn't store one. Never invent a value here;
    an absent field renders as an omitted line in print_header.html, not
    a placeholder."""

    school_name: Optional[str] = None
    logo_data_uri: Optional[str] = None
    registration_number: Optional[str] = None
    emis_number: Optional[str] = None
    physical_address: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    receipt_footer: Optional[str] = None


@dataclass
class ReceiptAllocationLine:
    description: str
    amount_display: str


@dataclass
class ReportTableSection:
    """One table within a report. `columns`/`rows` are already display-
    formatted strings (currency/date formatting happens in report_service.py,
    once, server-side -- never in the template, and never duplicated in the
    frontend, per the brief's own instruction)."""

    columns: list[str]
    rows: list[list[str]]
    heading: Optional[str] = None
    num_col_indexes: list[int] = field(default_factory=list)
    totals_row: Optional[list[str]] = None


@dataclass
class GenericReportContext:
    """Shared shape for every tabular financial report (Ledger, Financial
    Position, Comprehensive Income, Outstanding Fees, Payment Summary, ...)
    -- one template (financial/generic_report.html) renders all of them."""

    title: str
    period_label: str
    doc_meta: list[tuple[str, str]]
    summary_cards: list[tuple[str, str]] = field(default_factory=list)
    tables: list[ReportTableSection] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


@dataclass
class StudentStatementContext:
    student: str
    student_name: str
    grade: Optional[str]
    guardian_name: Optional[str]
    opening_balance_display: str
    total_invoiced_display: str
    total_paid_display: str
    outstanding_balance_display: str
    transactions: list[list[str]] = field(default_factory=list)  # [date, reference, description, debit, credit, balance]
    banking_details: list[list[str]] = field(default_factory=list)  # [bank, fee_stream, account_name, account_number, currency]


@dataclass
class ReceiptContext:
    name: str
    student: str
    student_name: str
    payment_method: str
    received_by_name: str
    amount_display: str
    outstanding_balance_display: str
    status: str
    grade: Optional[str] = None
    payer_name: Optional[str] = None
    external_reference: Optional[str] = None
    allocations: list[ReceiptAllocationLine] = field(default_factory=list)


@dataclass
class Ed46ReturnContext:
    """One MoPSE ED46 Return -- a fixed-layout regulatory form, not a
    tabular report, so it gets its own template (ed46_return.html) rather
    than reusing GenericReportContext."""

    name: str
    term: str
    school_name: Optional[str]
    registration_number: Optional[str]
    emis_number: Optional[str]
    school_code: Optional[str]
    physical_address: Optional[str]
    district: Optional[str]
    region: Optional[str]
    total_enrolment: int
    levy_base_amount_display: str
    total_revenue_billed_display: str
    total_revenue_realized_display: str
    workflow_state: str
    bursar_certified: bool
    school_head_certified: bool
    sdc_certified: bool
    staffing_support_analysis: Optional[str] = None
    certified_on_display: Optional[str] = None
