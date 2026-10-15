"""SchoolBrandingService -- reuses notifications._school_letterhead()
(the same real School Setup fields already used for emailed receipts/
invoices) instead of re-querying School Setup, so there's exactly one
place that decides what "the school's letterhead" means."""

import base64

import frappe
from frappe.utils.file_manager import get_file

from edupro_school_fees.notifications import _school_letterhead
from edupro_school_fees.print_reports.schemas.financial_reports import SchoolBranding


def get_school_branding() -> SchoolBranding:
    letterhead = _school_letterhead()
    if not letterhead:
        return SchoolBranding()

    logo_data_uri = None
    if letterhead.get("school_logo"):
        try:
            _, content = get_file(letterhead["school_logo"])
            logo_data_uri = f"data:image/png;base64,{base64.b64encode(content).decode()}"
        except Exception:
            frappe.log_error(title="print_reports: could not load school logo")

    return SchoolBranding(
        school_name=letterhead.get("school_name"),
        logo_data_uri=logo_data_uri,
        registration_number=letterhead.get("registration_number"),
        emis_number=letterhead.get("emis_number"),
        physical_address=letterhead.get("physical_address"),
        telephone=letterhead.get("telephone"),
        email=letterhead.get("email"),
        receipt_footer=letterhead.get("receipt_footer"),
    )
