# Copyright (c) 2025, Edupro and contributors
# For license information, please see license.txt

from . import __version__ as app_version

app_name = "edupro_school_fees"
app_title = "Edupro School Fees"
app_publisher = "Edupro"
app_description = "School Fees & Financial Statements System for Zimbabwean Schools"
app_icon = "octicon octicon-credit-card"
app_color = "blue"
app_email = "info@edupro.co.zw"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/edupro_school_fees/css/edupro_school_fees.css"
# app_include_js = "/assets/edupro_school_fees/js/edupro_school_fees.js"

# include js, css files in header of web template
# web_include_css = "/assets/edupro_school_fees/css/edupro_school_fees.css"
# web_include_js = "/assets/edupro_school_fees/js/edupro_school_fees.js"

# include custom scss in every website theme (without signing in)
# website_theme_scss_path = "edupro_school_fees/public/scss/website"

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page web interface for the specified DTYpe
# website_route_rules = [{"from_route": "/edupro_school_fees/<doctype_name>/<name>", "to_route": "edupro_school_fees",}]

# Websites that call this app
# ----------------------------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "edupro_school_fees.utils.jinja_methods",
# 	"filters": "edupro_school_fees.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "edupro_school_fees.install.before_install"
after_install = "edupro_school_fees.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "edupro_school_fees.uninstall.before_uninstall"
# after_uninstall = "edupro_school_fees.uninstall.after_uninstall"

# Integration Setup
# ------------------
# deprecation_warning = ""

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "edupro_school_fees.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in sandbox mode

permission_query_conditions = {
	"Student": "edupro_school_fees.permissions.student_permission_query",
	"Invoice": "edupro_school_fees.permissions.invoice_permission_query",
	"Receipt": "edupro_school_fees.permissions.receipt_permission_query",
	"Payment Plan": "edupro_school_fees.permissions.payment_plan_permission_query",
	"Fee Structure": "edupro_school_fees.permissions.fee_structure_permission_query",
	"Parent Guardian": "edupro_school_fees.permissions.parent_guardian_permission_query",
	"Requisition": "edupro_school_fees.permissions.requisition_permission_query",
	"Purchase Order": "edupro_school_fees.permissions.purchase_order_permission_query",
	"Payment Voucher": "edupro_school_fees.permissions.payment_voucher_permission_query",
	"Budget Line": "edupro_school_fees.permissions.budget_line_permission_query",
	"Cashbook Payment": "edupro_school_fees.permissions.cashbook_payment_permission_query",
	"Journal Entry": "edupro_school_fees.permissions.journal_entry_permission_query",
	"Credit Note": "edupro_school_fees.permissions.credit_note_permission_query",
}

has_permission = {
	"Student": "edupro_school_fees.permissions.has_student_permission",
	"Invoice": "edupro_school_fees.permissions.has_invoice_permission",
	"Receipt": "edupro_school_fees.permissions.has_receipt_permission",
	"Payment Plan": "edupro_school_fees.permissions.has_payment_plan_permission",
	"Fee Structure": "edupro_school_fees.permissions.has_fee_structure_permission",
	"Parent Guardian": "edupro_school_fees.permissions.has_parent_guardian_permission",
	"Requisition": "edupro_school_fees.permissions.has_requisition_permission",
	"Purchase Order": "edupro_school_fees.permissions.has_purchase_order_permission",
	"Payment Voucher": "edupro_school_fees.permissions.has_payment_voucher_permission",
	"Budget Line": "edupro_school_fees.permissions.has_budget_line_permission",
	"Cashbook Payment": "edupro_school_fees.permissions.has_cashbook_payment_permission",
	"Journal Entry": "edupro_school_fees.permissions.has_journal_entry_permission",
	"Credit Note": "edupro_school_fees.permissions.has_credit_note_permission",
}

# DocType Class
# ---------------

# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Invoice": {
		"on_submit": [
			"edupro_school_fees.utils.create_journal_entry_for_invoice",
			"edupro_school_fees.notifications.notify_invoice_raised",
		],
	},
	"Receipt": {
		"on_submit": [
			"edupro_school_fees.utils.create_journal_entry_for_receipt",
			"edupro_school_fees.utils.refresh_debtor_cases_for_student",
			"edupro_school_fees.notifications.notify_receipt_submitted",
		],
	},
	"Fee Structure": {
		"on_update": "edupro_school_fees.utils.log_fee_structure_transition",
	},
	"Debtor Case": {
		"on_update": "edupro_school_fees.utils.log_debtor_case_transition",
	},
	"Applicant": {
		"on_update": "edupro_school_fees.notifications.notify_applicant_decision",
	},
	"Payment Voucher": {
		"on_update": "edupro_school_fees.utils.log_payment_voucher_transition",
	},
	"School Setup": {
		"on_update": "edupro_school_fees.utils.log_school_setup_change",
	},
	"Purchase Order": {
		"after_insert": "edupro_school_fees.utils.log_purchase_order_issued",
	},
	# DEF-031/DEF-032: role changes and bank reconciliation sign-offs had zero
	# audit coverage before -- both follow the same on_update pattern already
	# used for every other workflow/state-change event above.
	"User": {
		"on_update": "edupro_school_fees.utils.log_user_role_change",
	},
	"Bank Reconciliation": {
		"on_update": "edupro_school_fees.utils.log_bank_reconciliation_transition",
	},
}

# Every login is a real, distinct audit event (FR-SEC/access-log requirement) --
# separate from doc_events since it isn't tied to any one DocType.
on_session_creation = "edupro_school_fees.utils.log_user_login"

# Scheduled Tasks
# ---------------

scheduler_events = {
	"daily": [
		"edupro_school_fees.utils.run_debtor_ageing_escalation",
		"edupro_school_fees.utils.check_payment_plan_installments",
	],
	"monthly": [
		"edupro_school_fees.utils.run_asset_depreciation",
	],
	"cron": {
		# 2am server time, daily -- full database + files backup, pruned to
		# the most recent 30 sets by backup.scheduled_backup() itself.
		"0 2 * * *": ["edupro_school_fees.backup.scheduled_backup"],
	},
}

# Testing
# -------

# before_tests = "edupro_school_fees.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "edupro_school_fees.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# it is generated from the request's JSON data
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "edupro_school_fees.edupro_school_fees.doctype.event.event.get_events"
# }
#
# each overriding method should be placed in edupro_school_fees/overrides.py

# fixtures
fixtures = ["Workflow"]

# Apps
# ------------------

# required_apps = []

# Each item will be installed when this app is installed
# install_apps = []

# Each item will be uninstalled when this app is uninstalled
# uninstall_apps = []

# Global variables available in all Jinja templates
# jinja_globals = {
# 	"get_edupro_settings": get_edupro_settings
# }
