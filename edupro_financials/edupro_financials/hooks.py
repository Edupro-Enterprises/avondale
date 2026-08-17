app_name = "edupro_financials"
app_title = "Edupro Financials"
app_publisher = "Edupro"
app_description = "Statutory multi-fund accounting, vote-book control, and MoPSE audit engine for Zimbabwean primary schools."
app_email = "ttshava@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "edupro_financials",
# 		"logo": "/assets/edupro_financials/logo.png",
# 		"title": "Edupro Financials",
# 		"route": "/edupro_financials",
# 		"has_permission": "edupro_financials.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/edupro_financials/css/edupro_financials.css"
# app_include_js = "/assets/edupro_financials/js/edupro_financials.js"

# include js, css files in header of web template
# web_include_css = "/assets/edupro_financials/css/edupro_financials.css"
# web_include_js = "/assets/edupro_financials/js/edupro_financials.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "edupro_financials/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "edupro_financials/public/icons.svg"

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

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "edupro_financials.utils.jinja_methods",
# 	"filters": "edupro_financials.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "edupro_financials.install.before_install"
after_install = "edupro_financials.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "edupro_financials.uninstall.before_uninstall"
# after_uninstall = "edupro_financials.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "edupro_financials.utils.before_app_install"
# after_app_install = "edupro_financials.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "edupro_financials.utils.before_app_uninstall"
# after_app_uninstall = "edupro_financials.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "edupro_financials.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"edupro_financials.tasks.all"
# 	],
# 	"daily": [
# 		"edupro_financials.tasks.daily"
# 	],
# 	"hourly": [
# 		"edupro_financials.tasks.hourly"
# 	],
# 	"weekly": [
# 		"edupro_financials.tasks.weekly"
# 	],
# 	"monthly": [
# 		"edupro_financials.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "edupro_financials.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "edupro_financials.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "edupro_financials.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["edupro_financials.utils.before_request"]
# after_request = ["edupro_financials.utils.after_request"]

# Job Events
# ----------
# before_job = ["edupro_financials.utils.before_job"]
# after_job = ["edupro_financials.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"edupro_financials.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

fixtures = [
	{"dt": "Print Format", "filters": [["module", "=", "Edupro Financials"]]},
	{"dt": "Letter Head", "filters": [["name", "=", "Avondale Primary School"]]},
]

doc_events = {
	"Purchase Order": {
		"validate": "edupro_financials.vote_book.validate_vote_book_budget",
		"on_submit": "edupro_financials.vote_book.commit_vote_book_amount",
		"on_cancel": "edupro_financials.vote_book.release_vote_book_amount",
	},
	"Fees": {
		"on_submit": "edupro_financials.receipts.assign_receipt_number",
		"before_cancel": "edupro_financials.credit_notes.require_cancellation_reason",
		"before_print": "edupro_financials.receipts.attach_combined_fee_context",
	},
	"Sales Invoice": {
		"on_submit": "edupro_financials.receipts.assign_receipt_number",
	},
}
