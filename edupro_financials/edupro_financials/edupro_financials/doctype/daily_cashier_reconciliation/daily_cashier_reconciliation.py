import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class DailyCashierReconciliation(Document):
	def before_submit(self):
		# Blind count: the cashier enters usd_cash_counted / ecocash_batch_total /
		# zipit_batch_total with no visibility of the system-expected figure. The
		# expected total and variance are only computed here, at submit time, once
		# the physical count is locked in.
		self.system_expected_usd = self.get_system_expected_usd()
		counted_total = (
			flt(self.usd_cash_counted)
			+ flt(self.ecocash_batch_total)
			+ flt(self.zipit_batch_total)
		)
		self.variance_usd = counted_total - flt(self.system_expected_usd)

	def get_system_expected_usd(self):
		total = frappe.db.sql(
			"""
			select coalesce(sum(sip.amount), 0)
			from `tabSales Invoice Payment` sip
			inner join `tabSales Invoice` si on si.name = sip.parent
			where si.docstatus = 1
			  and si.posting_date = %(reconciliation_date)s
			  and si.owner = %(cashier_user)s
			""",
			{
				"reconciliation_date": self.reconciliation_date,
				"cashier_user": self.cashier_user,
			},
		)[0][0]
		return flt(self.opening_float) + flt(total)
