import frappe
import openpyxl
import json
import re

XLSX_PATH = "/home/frappe/frappe-bench/Grade7_Pastel_Balances_Clean.xlsx"
COMPANY = "Avondale Primary School"
ACADEMIC_YEAR = "2026"
PROGRAM = "Grade 7"
FEE_STRUCTURE = "EDU-FST-2026-00017"  # Grade 7 Levy, SDC / SDA Fund
FUND = "SDC / SDA Fund"
RECEIVABLE_ACCOUNT = "Debtors - APS"


def parse_class(raw):
    # "34 - 7M-2026" -> "7M"
    part = raw.split(" - ")[-1]
    return part.split("-")[0].strip()


def parse_name(raw):
    # Pastel format is "Surname Firstname [Middle]" - matches debtor code prefixes
    # (e.g. "Banwa Elnathan" / code "BANW18").
    parts = raw.strip().split(None, 1)
    last_name = parts[0]
    first_name = parts[1] if len(parts) > 1 else parts[0]
    return first_name, last_name


def run():
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    ws = wb["Grade 7 Balances"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    created = {"students": 0, "enrollments": 0, "fees": 0}
    errors = []

    for row in rows:
        class_raw, code, name_raw, fee_tag, flagged, currency, d120, d90, d60, d30, current, total_due = row
        try:
            batch_name = parse_class(class_raw)
            first_name, last_name = parse_name(name_raw)
            ascii_code = re.sub(r"[^a-z0-9]", "x", code.strip().lower())
            email = f"{ascii_code}@pastel.import.local"

            # Student
            if frappe.db.exists("Student", {"pastel_account_code": code}):
                student_name_id = frappe.db.get_value("Student", {"pastel_account_code": code}, "name")
            else:
                student_doc = frappe.get_doc({
                    "doctype": "Student",
                    "first_name": first_name,
                    "last_name": last_name,
                    "student_name": name_raw,
                    "student_email_id": email,
                    "pastel_account_code": code,
                })
                student_doc.insert(ignore_permissions=True)
                student_name_id = student_doc.name
                created["students"] += 1

            # Program Enrollment
            pe_name = frappe.db.get_value(
                "Program Enrollment",
                {"student": student_name_id, "program": PROGRAM, "academic_year": ACADEMIC_YEAR},
                "name",
            )
            if not pe_name:
                pe_doc = frappe.get_doc({
                    "doctype": "Program Enrollment",
                    "student": student_name_id,
                    "enrollment_date": "2026-01-01",
                    "program": PROGRAM,
                    "academic_year": ACADEMIC_YEAR,
                    "student_batch_name": batch_name,
                })
                pe_doc.insert(ignore_permissions=True)
                pe_name = pe_doc.name
                created["enrollments"] += 1

            # Opening-balance Fees (Levy / SDC-SDA fund, per confirmed scope)
            existing_fees = frappe.db.exists("Fees", {"student": student_name_id, "fee_structure": FEE_STRUCTURE, "is_opening_balance": 1})
            if not existing_fees:
                fees_doc = frappe.get_doc({
                    "doctype": "Fees",
                    "student": student_name_id,
                    "student_name": name_raw,
                    "company": COMPANY,
                    "posting_date": "2026-01-01",
                    "due_date": "2026-01-01",
                    "program_enrollment": pe_name,
                    "program": PROGRAM,
                    "academic_year": ACADEMIC_YEAR,
                    "fee_structure": FEE_STRUCTURE,
                    "components": [{"fees_category": "Levy", "amount": total_due}],
                    "grand_total": total_due,
                    "receivable_account": RECEIVABLE_ACCOUNT,
                    "fund": FUND,
                    "student_batch": batch_name,
                    "is_opening_balance": 1,
                })
                fees_doc.insert(ignore_permissions=True)
                fees_doc.submit()
                created["fees"] += 1

        except Exception as e:
            errors.append({"code": code, "name": name_raw, "error": str(e)[:300]})

    frappe.db.commit()
    print("RESULT_JSON:" + json.dumps({"created": created, "errors": errors, "total_rows": len(rows)}, default=str))


run()
