import frappe
from frappe import _
from frappe.utils import flt, getdate, date_diff, nowdate

# Term length approximated at 90 days for bucketing purposes, matching the
# 3-term Zimbabwean school year (no explicit term-sequence exists on
# Academic Term to bucket by "terms elapsed" directly).
TERM_LENGTH_DAYS = 90


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"label": _("Student"), "fieldname": "student", "fieldtype": "Link", "options": "Student", "width": 120},
		{"label": _("Student Name"), "fieldname": "student_name", "fieldtype": "Data", "width": 160},
		{"label": _("Class"), "fieldname": "student_batch_name", "fieldtype": "Data", "width": 80},
		{"label": _("Term"), "fieldname": "academic_term", "fieldtype": "Data", "width": 130},
		{"label": _("Fund"), "fieldname": "fund", "fieldtype": "Link", "options": "Fund", "width": 160},
		{"label": _("Currency"), "fieldname": "currency", "fieldtype": "Data", "width": 80},
		{"label": _("Due Date"), "fieldname": "due_date", "fieldtype": "Date", "width": 100},
		{"label": _("Days Overdue"), "fieldname": "days_overdue", "fieldtype": "Int", "width": 100},
		{"label": _("Age Bucket"), "fieldname": "age_bucket", "fieldtype": "Data", "width": 110},
		{"label": _("Outstanding Amount"), "fieldname": "outstanding_amount", "fieldtype": "Currency", "width": 150},
		{"label": _("BEAM Status"), "fieldname": "beam_status", "fieldtype": "Data", "width": 100},
	]


def get_age_bucket(days_overdue):
	if days_overdue <= 0:
		return _("Current")
	if days_overdue <= TERM_LENGTH_DAYS:
		return _("1 Term")
	if days_overdue <= TERM_LENGTH_DAYS * 2:
		return _("2 Terms")
	return _("3+ Terms")


def get_data(filters):
	as_on_date = getdate(filters.get("as_on_date") or nowdate())

	conditions = ["fees.docstatus = 1", "fees.outstanding_amount > 0"]
	values = {"as_on_date": as_on_date}

	if filters.get("academic_year"):
		conditions.append("fees.academic_year = %(academic_year)s")
		values["academic_year"] = filters["academic_year"]

	if filters.get("academic_term"):
		conditions.append("fees.academic_term = %(academic_term)s")
		values["academic_term"] = filters["academic_term"]

	if filters.get("fund"):
		conditions.append("fees.fund = %(fund)s")
		values["fund"] = filters["fund"]

	if filters.get("student_batch_name"):
		conditions.append("pe.student_batch_name = %(student_batch_name)s")
		values["student_batch_name"] = filters["student_batch_name"]

	# Due-date range: a separate concern from as_on_date (which is the
	# reference point for computing days-overdue/bucketing) - this narrows
	# *which* bills are included in the first place, e.g. "only bills due
	# between 1 Jan and 30 Jun".
	if filters.get("from_date"):
		conditions.append("fees.due_date >= %(from_date)s")
		values["from_date"] = filters["from_date"]

	if filters.get("to_date"):
		conditions.append("fees.due_date <= %(to_date)s")
		values["to_date"] = filters["to_date"]

	rows = frappe.db.sql(
		f"""
		select
			fees.name as fees_name,
			fees.student,
			fees.student_name,
			fees.academic_term,
			fees.currency,
			fees.due_date,
			fees.outstanding_amount,
			fees.fund as fund,
			pe.student_batch_name
		from `tabFees` fees
		left join `tabProgram Enrollment` pe on pe.name = fees.program_enrollment
		where {' and '.join(conditions)}
		""",
		values,
		as_dict=True,
	)

	beam_students = set(
		frappe.get_all(
			"Student Exemption and Discount",
			filters={"exemption_type": "BEAM"},
			pluck="student",
		)
	)

	data = []
	for row in rows:
		days_overdue = date_diff(as_on_date, row.due_date) if row.due_date else 0
		data.append(
			{
				"student": row.student,
				"student_name": row.student_name,
				"student_batch_name": row.student_batch_name,
				"academic_term": row.academic_term,
				"fund": row.fund,
				"currency": row.currency,
				"due_date": row.due_date,
				"days_overdue": days_overdue,
				"age_bucket": get_age_bucket(days_overdue),
				"outstanding_amount": flt(row.outstanding_amount),
				"beam_status": _("BEAM") if row.student in beam_students else "",
			}
		)
	return data
