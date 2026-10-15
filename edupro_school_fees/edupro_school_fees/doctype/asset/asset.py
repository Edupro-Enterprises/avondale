import frappe
from frappe.model.document import Document
from frappe.utils import flt


class Asset(Document):
	def validate(self):
		self.net_book_value = flt(self.historical_cost - (self.accumulated_depreciation or 0), 2)

		if self.has_value_changed("disposal_status") and self.disposal_status == "Disposed" and not self.disposal_date:
			frappe.throw("Disposal Date is required when marking an asset Disposed.")
