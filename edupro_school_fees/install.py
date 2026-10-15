# Copyright (c) 2025, Edupro and contributors
# For license information, please see license.txt

import frappe


def after_install():
	"""Create default data after app installation."""
	create_default_regions()
	create_default_provinces()
	create_default_academic_year()
	frappe.db.commit()


def create_default_regions():
	"""Create default regions if they don't exist."""
	regions = [
		{"region_name": "Eastern", "code": "EAST"},
		{"region_name": "Western", "code": "WEST"},
		{"region_name": "Central", "code": "CENT"},
		{"region_name": "Northern", "code": "NORTH"},
		{"region_name": "Southern", "code": "SOUTH"}
	]
	
	for region_data in regions:
		if not frappe.db.exists("Region", region_data["region_name"]):
			region = frappe.get_doc({
				"doctype": "Region",
				"region_name": region_data["region_name"],
				"code": region_data["code"]
			})
			region.insert(ignore_permissions=True)
	
	frappe.msgprint("Default regions created successfully", alert=True)


def create_default_provinces():
	"""Create default provinces if they don't exist."""
	# Get regions first
	regions = frappe.get_all("Region", pluck="name")
	if not regions:
		return
	
	default_province = "Central Province"
	if not frappe.db.exists("Province", default_province):
		province = frappe.get_doc({
			"doctype": "Province",
			"province_name": default_province,
			"region": regions[0] if regions else "Central"
		})
		province.insert(ignore_permissions=True)
	
	frappe.msgprint("Default provinces created successfully", alert=True)


def create_default_academic_year():
	"""Create a default academic year if none exists."""
	if frappe.db.count("Academic Year") > 0:
		return
	
	from dateutil.relativedelta import relativedelta
	
	today = frappe.utils.nowdate()
	current_year = frappe.utils.getdate(today).year
	
	start_date = frappe.utils.add_days(today, -30)
	end_date = frappe.utils.add_days(today, 335)
	
	academic_year = frappe.get_doc({
		"doctype": "Academic Year",
		"academic_year_name": f"{current_year} Academic Year",
		"start_date": start_date,
		"end_date": end_date,
		"is_active": 1,
		"is_current": 1
	})
	academic_year.insert(ignore_permissions=True)
	
	frappe.msgprint(f"Default Academic Year '{current_year} Academic Year' created with 3 terms", alert=True)
