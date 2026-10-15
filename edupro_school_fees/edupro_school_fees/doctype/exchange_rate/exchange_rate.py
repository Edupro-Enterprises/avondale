import frappe
from frappe.model.document import Document
from frappe.utils import getdate


class ExchangeRate(Document):
	def validate(self):
		if self.from_currency == self.to_currency:
			frappe.throw("From Currency and To Currency must be different.")

		self._validate_immutable_fields()
		self._validate_no_duplicate_active_rate()

	def _validate_immutable_fields(self):
		# Corrections happen by creating a new dated rate, not editing history -- once
		# saved, a rate can never change under any consumer that already snapshotted it
		# (e.g. Journal Entry Account.exchange_rate).
		if self.is_new():
			return

		previous = frappe.db.get_value(
			"Exchange Rate",
			self.name,
			["from_currency", "to_currency", "effective_date", "exchange_rate"],
			as_dict=True,
		)
		if not previous:
			return

		locked = {
			"from_currency": (self.from_currency, previous.from_currency),
			"to_currency": (self.to_currency, previous.to_currency),
			"effective_date": (getdate(self.effective_date), getdate(previous.effective_date)),
			"exchange_rate": (round(self.exchange_rate or 0, 6), round(previous.exchange_rate or 0, 6)),
		}
		for fieldname, (current_value, previous_value) in locked.items():
			if current_value != previous_value:
				frappe.throw(
					f"{self.meta.get_label(fieldname)} cannot be changed once an Exchange "
					"Rate is saved. Create a new rate row instead."
				)

	def _validate_no_duplicate_active_rate(self):
		if not self.is_active:
			return

		duplicate = frappe.db.exists(
			"Exchange Rate",
			{
				"from_currency": self.from_currency,
				"to_currency": self.to_currency,
				"effective_date": self.effective_date,
				"is_active": 1,
				"name": ["!=", self.name],
			},
		)
		if duplicate:
			frappe.throw(
				f"An active exchange rate for {self.from_currency} -> {self.to_currency} "
				f"on {self.effective_date} already exists: {duplicate}."
			)
