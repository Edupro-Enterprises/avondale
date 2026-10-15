"""FR-COM-01 / FR-PRT-14..16: email + SMS delivery, restricted to a parent or
guardian's own stored contact channels only (FR-COM-02) -- never a student's,
since no such channel is ever collected for one anyway. Every attempt,
successful or silently skipped, is logged to Communication Log (FR-COM-04).

Email uses Frappe's own frappe.sendmail(), which relies on whatever SMTP/Email
Account the site's System Manager has already configured in Desk
(spec INT-14..18) -- this module never touches mail credentials directly.

SMS uses Africa's Talking (the spec's named provider, INT-04), read from site
config keys `africastalking_api_key`/`africastalking_username`
(bench set-config, never committed to source control -- same externalized-
secrets convention the spec's own INT-14..18 email settings already use).
If those aren't configured, SMS is silently skipped, not an error -- a school
that hasn't set it up yet still gets email rather than every notification
failing outright.

Nothing here ever raises out to its caller: a notification failure must
never block the financial action (an invoice, a receipt, an admissions
decision) that triggered it.
"""

import frappe


def _log(summary, channel, parent_guardian=None, applicant=None, student=None, debtor_case=None):
	frappe.get_doc({
		"doctype": "Communication Log",
		"parent_guardian": parent_guardian,
		"applicant": applicant,
		"student": student,
		"debtor_case": debtor_case,
		"channel": channel,
		"direction": "Outbound",
		"summary": summary,
	}).insert(ignore_permissions=True)


def _send_email(email, subject, message, attachments=None, **log_kwargs):
	if not email:
		return
	try:
		frappe.sendmail(recipients=[email], subject=subject, message=message, attachments=attachments)
		_log(f"{subject}: {message}", "Email", **log_kwargs)
	except Exception:
		frappe.log_error(title="Email notification failed", message=frappe.get_traceback())


def _send_sms(phone, message, **log_kwargs):
	if not phone:
		return
	api_key = frappe.conf.get("africastalking_api_key")
	username = frappe.conf.get("africastalking_username")
	if not api_key or not username:
		return  # SMS not configured for this school -- not an error, just skipped.

	try:
		import requests

		requests.post(
			"https://api.africastalking.com/version1/messaging",
			data={"username": username, "to": phone, "message": message},
			headers={"apiKey": api_key, "Accept": "application/json"},
			timeout=10,
		)
		_log(message, "SMS", **log_kwargs)
	except Exception:
		frappe.log_error(title="SMS notification failed", message=frappe.get_traceback())


def _guardian_for_student(student_name):
	guardian_name = frappe.db.get_value("Student", student_name, "guardian")
	return frappe.get_doc("Parent Guardian", guardian_name) if guardian_name else None


def _outstanding_balance(student_name):
	"""Sum of a student's own still-open Invoices -- the same figure the
	Debtor Case/Payment Desk pages show, computed independently here so a
	receipt email always reflects the real ledger, not a cached value."""
	return sum(frappe.get_all(
		"Invoice",
		filters={"student": student_name, "docstatus": 1, "outstanding_amount": [">", 0]},
		pluck="outstanding_amount",
	))


def _school_letterhead():
	from edupro_school_fees.utils import _school_setup_name

	setup_name = _school_setup_name()
	if not setup_name:
		return {}
	return frappe.db.get_value(
		"School Setup", setup_name,
		["school_name", "school_logo", "registration_number", "emis_number", "physical_address", "telephone", "email", "receipt_header", "receipt_footer"],
		as_dict=True,
	) or {}


def _receipt_pdf_bytes(receipt, student_name, outstanding_balance):
	"""Server-side mirror of the theme's own receipt PDF template (see that
	repo's lib/export.ts) -- needed here because frappe.sendmail() runs on
	the server, where the browser-side jsPDF pipeline isn't available."""
	import base64

	from frappe.utils.file_manager import get_file
	from frappe.utils.pdf import get_pdf

	letterhead = _school_letterhead()
	logo_html = ""
	if letterhead.get("school_logo"):
		try:
			_, content = get_file(letterhead["school_logo"])
			logo_html = f'<img src="data:image/png;base64,{base64.b64encode(content).decode()}" style="height:56px;margin-bottom:8px;" />'
		except Exception:
			logo_html = ""

	id_line = " &middot; ".join(filter(None, [
		f"Reg. No: {letterhead['registration_number']}" if letterhead.get("registration_number") else None,
		f"EMIS: {letterhead['emis_number']}" if letterhead.get("emis_number") else None,
	]))
	contact = " &nbsp; ".join(filter(None, [letterhead.get("physical_address"), letterhead.get("telephone"), letterhead.get("email")]))
	amount_display = f"{receipt.currency} {receipt.amount:,.2f}" if receipt.currency == "ZiG" else f"${receipt.amount:,.2f}"

	html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body {{ font-family: Helvetica, Arial, sans-serif; color: #111; padding: 24px; max-width: 420px; margin: 0 auto; }}
.header {{ text-align: center; margin-bottom: 12px; }}
.header h1 {{ font-size: 16px; margin: 0; }}
.header p {{ font-size: 11px; color: #666; margin: 4px 0 0; }}
.title {{ text-align: center; font-size: 14px; font-weight: bold; letter-spacing: 0.05em; margin: 16px 0; }}
hr {{ border: none; border-top: 1px solid #ccc; margin: 12px 0; }}
.row, .amount, .balance {{ display: table; width: 100%; padding: 4px 0; }}
.row .label, .amount .label, .balance .label {{ display: table-cell; color: #666; }}
.row .value, .amount .value, .balance .value {{ display: table-cell; text-align: right; font-weight: bold; }}
.amount {{ margin: 16px 0; }}
.amount .label {{ font-size: 13px; }}
.amount .value {{ font-size: 22px; }}
.balance {{ margin: 8px 0; padding: 8px; background: #f5f5f5; border-radius: 4px; }}
.balance .value {{ font-size: 16px; }}
.footer {{ font-size: 10px; color: #666; font-style: italic; margin-top: 16px; }}
</style></head><body>
<div class="header">
  {logo_html}
  <h1>{letterhead.get('school_name') or 'School'}</h1>
  {f'<p>{id_line}</p>' if id_line else ''}
  {f'<p>{contact}</p>' if contact else ''}
  {f"<p><em>{letterhead['receipt_header']}</em></p>" if letterhead.get('receipt_header') else ''}
</div>
<div class="title">OFFICIAL RECEIPT</div>
<hr />
<div class="row"><span class="label">Receipt No.</span><span class="value">{receipt.name}</span></div>
<div class="row"><span class="label">Date</span><span class="value">{receipt.posting_date}</span></div>
<div class="row"><span class="label">Student</span><span class="value">{student_name} ({receipt.student})</span></div>
<div class="row"><span class="label">Payment Method</span><span class="value">{receipt.payment_method}</span></div>
<hr />
<div class="amount"><span class="label">Amount Paid</span><span class="value">{amount_display}</span></div>
<div class="balance"><span class="label">Outstanding Balance</span><span class="value">${outstanding_balance:,.2f}</span></div>
{f"<p class='footer'>{letterhead['receipt_footer']}</p>" if letterhead.get('receipt_footer') else ''}
</body></html>"""

	return get_pdf(html)


def notify_invoice_raised(doc, method=None):
	guardian = _guardian_for_student(doc.student)
	if not guardian:
		return
	subject = f"Invoice {doc.name} raised"
	message = f"A new invoice for {doc.total_amount} has been raised. Outstanding balance: {doc.outstanding_amount}."
	_send_email(guardian.email, subject, message, parent_guardian=guardian.name, student=doc.student)
	_send_sms(guardian.phone_number, f"{subject}. {message}", parent_guardian=guardian.name, student=doc.student)


def notify_receipt_submitted(doc, method=None):
	if doc.reversal_of:
		return  # a reversal is a correction, not "payment received" -- don't tell a parent they paid.
	guardian = _guardian_for_student(doc.student)
	if not guardian:
		return

	outstanding = _outstanding_balance(doc.student)
	amount_display = f"{doc.currency} {doc.amount:,.2f}" if doc.currency == "ZiG" else f"${doc.amount:,.2f}"
	subject = f"Payment received - {doc.name}"
	message = f"We have received your payment of {amount_display}. Your outstanding balance is now ${outstanding:,.2f}. Thank you."

	attachments = None
	try:
		name_parts = frappe.db.get_value("Student", doc.student, ["first_name", "last_name"])
		student_name = " ".join(p for p in (name_parts or ()) if p) or doc.student
		attachments = [{"fname": f"{doc.name}.pdf", "fcontent": _receipt_pdf_bytes(doc, student_name, outstanding)}]
	except Exception:
		# A PDF failure must never block the notification itself -- send the
		# email without the attachment rather than not at all.
		frappe.log_error(title="Receipt PDF generation failed", message=frappe.get_traceback())

	_send_email(guardian.email, subject, message, attachments=attachments, parent_guardian=guardian.name, student=doc.student)
	_send_sms(guardian.phone_number, f"{subject}. {message}", parent_guardian=guardian.name, student=doc.student)


def notify_applicant_decision(doc, method=None):
	"""No Parent Guardian record exists yet at this stage -- logged against the
	Applicant itself instead (Communication Log.applicant)."""
	if not doc.has_value_changed("status") or doc.status not in ("Accepted", "Declined"):
		return

	if doc.status == "Accepted":
		subject = f"Application accepted - {doc.full_legal_name}"
		message = f"Congratulations -- {doc.full_legal_name}'s application has been accepted. Please contact the school office to complete enrolment."
	else:
		subject = f"Application update - {doc.full_legal_name}"
		message = f"We regret to inform you that {doc.full_legal_name}'s application was not successful this time."

	_send_email(doc.guardian_email, subject, message, applicant=doc.name)
	_send_sms(doc.guardian_phone, f"{subject}. {message}", applicant=doc.name)


def _render(text, student_name, case):
	if not text:
		return text
	return text.replace("{studentName}", student_name).replace("{amount}", str(case.outstanding_amount)).replace("{ageingBucket}", case.ageing_bucket)


def _invoice_pdf_bytes(invoice, student_name):
	"""Server-side PDF for a single Invoice -- see _receipt_pdf_bytes's own
	comment for why this can't just reuse the browser-side jsPDF pipeline."""
	from frappe.utils.pdf import get_pdf

	letterhead = _school_letterhead()
	id_line = " &middot; ".join(filter(None, [
		f"Reg. No: {letterhead['registration_number']}" if letterhead.get("registration_number") else None,
		f"EMIS: {letterhead['emis_number']}" if letterhead.get("emis_number") else None,
	]))
	rows_html = "".join(
		f"<tr><td>{item.description or item.fee_item}</td><td style='text-align:right'>{item.amount:,.2f}</td></tr>"
		for item in invoice.items
	)

	html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body {{ font-family: Helvetica, Arial, sans-serif; color: #111; padding: 24px; max-width: 480px; margin: 0 auto; }}
.header {{ text-align: center; margin-bottom: 12px; }}
.header h1 {{ font-size: 16px; margin: 0; }}
.header p {{ font-size: 11px; color: #666; margin: 4px 0 0; }}
.title {{ text-align: center; font-size: 14px; font-weight: bold; letter-spacing: 0.05em; margin: 16px 0; }}
hr {{ border: none; border-top: 1px solid #ccc; margin: 12px 0; }}
.row, .total {{ display: table; width: 100%; padding: 4px 0; }}
.row .label, .total .label {{ display: table-cell; color: #666; }}
.row .value, .total .value {{ display: table-cell; text-align: right; font-weight: bold; }}
table.items {{ width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }}
th {{ text-align: left; background: #f2f2f2; padding: 6px 8px; }}
td {{ padding: 6px 8px; border-top: 1px solid #eee; }}
.total {{ margin: 16px 0; }}
.total .label {{ font-size: 13px; }}
.total .value {{ font-size: 20px; }}
</style></head><body>
<div class="header">
  <h1>{letterhead.get('school_name') or 'School'}</h1>
  {f'<p>{id_line}</p>' if id_line else ''}
</div>
<div class="title">INVOICE</div>
<hr />
<div class="row"><span class="label">Invoice No.</span><span class="value">{invoice.name}</span></div>
<div class="row"><span class="label">Date</span><span class="value">{invoice.posting_date}</span></div>
<div class="row"><span class="label">Student</span><span class="value">{student_name} ({invoice.student})</span></div>
<div class="row"><span class="label">Term</span><span class="value">{invoice.term}</span></div>
{f'<div class="row"><span class="label">Due Date</span><span class="value">{invoice.due_date}</span></div>' if invoice.due_date else ''}
<table class="items"><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>{rows_html}</tbody></table>
<div class="total"><span class="label">Total Amount</span><span class="value">${invoice.total_amount:,.2f}</span></div>
<div class="row"><span class="label">Outstanding</span><span class="value">${invoice.outstanding_amount:,.2f}</span></div>
</body></html>"""

	return get_pdf(html)


def email_invoice_document(invoice):
	"""Builds this Invoice's PDF and emails it to the student's guardian --
	the Batch Invoicing page's "email" action (single or batch), distinct
	from notify_invoice_raised's plain-text on_submit notification, which
	never carried an attachment."""
	guardian = _guardian_for_student(invoice.student)
	if not guardian or not guardian.email:
		return False

	name_parts = frappe.db.get_value("Student", invoice.student, ["first_name", "last_name"])
	student_name = " ".join(p for p in (name_parts or ()) if p) or invoice.student
	pdf_bytes = _invoice_pdf_bytes(invoice, student_name)

	subject = f"Invoice {invoice.name}"
	message = (
		f"Please find attached Invoice {invoice.name} for {student_name}, "
		f"total ${invoice.total_amount:,.2f}, outstanding ${invoice.outstanding_amount:,.2f}."
	)
	_send_email(
		guardian.email, subject, message,
		attachments=[{"fname": f"{invoice.name}.pdf", "fcontent": pdf_bytes}],
		parent_guardian=guardian.name, student=invoice.student,
	)
	return True


def notify_debtor_reminder(case, stage, template_name=None):
	"""FR-PRT-15/16's graduated cadence: a milder nudge at the school's configured
	first-reminder day threshold, a firmer one at the second -- run_debtor_ageing_
	escalation() calls this at most once per stage per overdue cycle. Uses the
	School Setup-configured Communication Template's text (with placeholders
	substituted) when one is set for this stage, otherwise a sensible default
	message in the same style as notify_debt_escalation's own hardcoded one."""
	if not case.parent_guardian:
		return
	guardian = frappe.get_doc("Parent Guardian", case.parent_guardian)
	name_parts = frappe.db.get_value("Student", case.student, ["first_name", "last_name"])
	student_name = " ".join(p for p in (name_parts or ()) if p) or case.student

	template = frappe.get_doc("Communication Template", template_name) if template_name and frappe.db.exists("Communication Template", template_name) else None
	if template:
		subject = _render(template.subject, student_name, case) or f"Payment reminder - {case.name}"
		message = _render(template.body, student_name, case)
	else:
		subject = f"{'Second n' if stage == 'Second' else 'N'}otice: overdue balance - {case.name}"
		message = (
			f"{student_name}'s account has an outstanding balance of {case.outstanding_amount} ({case.ageing_bucket}). "
			"Please contact the Bursar's office to settle this or discuss a payment plan."
		)

	_send_email(guardian.email, subject, message, parent_guardian=guardian.name, student=case.student, debtor_case=case.name)
	_send_sms(guardian.phone_number, f"{subject}. {message}", parent_guardian=guardian.name, student=case.student, debtor_case=case.name)


def notify_debt_escalation(case, method=None):
	"""FR-PRT-16: a debt notice once a Debtor Case is escalated past 90 days
	overdue -- called from utils.run_debtor_ageing_escalation()."""
	if not case.parent_guardian:
		return
	guardian = frappe.get_doc("Parent Guardian", case.parent_guardian)
	subject = f"Overdue balance notice - {case.name}"
	message = (
		f"Your account has an overdue balance of {case.outstanding_amount} ({case.ageing_bucket}). "
		"Please contact the Bursar's office to discuss a payment plan."
	)
	_send_email(guardian.email, subject, message, parent_guardian=guardian.name, student=case.student, debtor_case=case.name)
	_send_sms(guardian.phone_number, f"{subject}. {message}", parent_guardian=guardian.name, student=case.student, debtor_case=case.name)
