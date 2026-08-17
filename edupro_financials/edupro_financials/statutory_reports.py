"""Portal-facing access to the statutory Script Reports.

Script Reports normally run through frappe.desk.query_report.run, which
requires Desk "Report" permission - exactly what Headmaster/Bursar/SDC
Chairperson/Deputy Head are locked out of (desk_access=0, spec section on
role access). Their underlying execute(filters) functions are plain Python
though, so this module just calls them directly and returns {columns, data}
over a whitelisted REST method the portal can hit like any other endpoint.
"""

import json

import frappe

from edupro_financials.edupro_financials.report.age_analyzed_fee_arrears_schedule import (
	age_analyzed_fee_arrears_schedule as _fee_arrears,
)
from edupro_financials.edupro_financials.report.mopse_statement_of_financial_performance import (
	mopse_statement_of_financial_performance as _mopse_performance,
)
from edupro_financials.edupro_financials.report.mopse_statement_of_financial_position import (
	mopse_statement_of_financial_position as _mopse_position,
)
from edupro_financials.edupro_financials.report.vote_book_variance_statement import (
	vote_book_variance_statement as _vote_book_variance,
)

REPORTS = {
	"fee_arrears_aging": _fee_arrears,
	"mopse_financial_performance": _mopse_performance,
	"mopse_financial_position": _mopse_position,
	"vote_book_variance": _vote_book_variance,
}


@frappe.whitelist()
def get_statutory_report(report_key, filters=None):
	if report_key not in REPORTS:
		frappe.throw(f"Unknown statutory report: {report_key}")

	if isinstance(filters, str):
		filters = json.loads(filters) if filters else {}

	columns, data = REPORTS[report_key].execute(filters or {})
	return {"columns": columns, "data": data}


@frappe.whitelist()
def get_default_filters():
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	return {
		"company": company,
		"as_on_date": frappe.utils.nowdate(),
		"academic_year": frappe.db.get_value(
			"Academic Year", {}, "name", order_by="year_start_date desc"
		),
	}
