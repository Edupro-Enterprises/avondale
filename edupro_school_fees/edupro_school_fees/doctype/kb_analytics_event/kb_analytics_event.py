import frappe
from frappe.model.document import Document

_REQUIRED_FIELDS = {
	"Article View": ["article_slug"],
	"Search": ["search_query"],
	"Feedback": ["article_slug", "vote"],
}


class KBAnalyticsEvent(Document):
	def validate(self):
		for field in _REQUIRED_FIELDS.get(self.event_type, []):
			if not self.get(field):
				frappe.throw(f'A "{self.event_type}" event requires {field}.')
