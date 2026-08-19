import frappe
import openpyxl
import json
import re

XLSX_PATH = "/home/frappe/frappe-bench/Grade2.xlsx"
COMPANY = "Avondale Primary School"
ACADEMIC_YEAR = "2026"
PROGRAM = "Grade 2"
FEE_STRUCTURE = "EDU-FST-2026-00007"  # Grade 2 Levy, SDC / SDA Fund
FUND = "SDC / SDA Fund"
RECEIVABLE_ACCOUNT = "Debtors - APS"
TARGET_CLASSES = {"2L", "2M", "2N", "2P"}


def parse_name_cell(raw):
    # "ADI23 - Adisalasi Ruvarashe K" or "CHIKWI - Chikwinya Douglas BEAM"
    code, _, name_part = raw.partition(" - ")
    code = code.strip()
    name_part = name_part.strip()
    tag = None
    for kw in ("BEAM", "STAFF", "HARDSHIP"):
        if name_part.upper().endswith(kw):
            tag = kw
            name_part = name_part[: -len(kw)].strip()
            break
    return code, name_part, tag


def split_person_name(raw):
    parts = raw.strip().split(None, 1)
    last_name = parts[0]
    first_name = parts[1] if len(parts) > 1 else parts[0]
    return first_name, last_name


def run():
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    ws = wb["Sheet1"]
    rows = list(ws.iter_rows(min_row=1, values_only=True))

    cats = [(i, r[0]) for i, r in enumerate(rows) if r[0] and isinstance(r[0], str) and r[0].startswith("Category")]

    student_rows = []
    for idx, (start, label) in enumerate(cats):
        end = cats[idx + 1][0] if idx + 1 < len(cats) else len(rows)
        class_code = label.split(" - ")[-1].split("-2026")[0]
        if class_code not in TARGET_CLASSES:
            continue
        for r in rows[start + 1 : end]:
            if r[0] and isinstance(r[0], str) and " - " in r[0]:
                student_rows.append((class_code, r))

    created = {"students": 0, "enrollments": 0, "fees": 0}
    errors = []
    tags_found = []

    for batch_name, row in student_rows:
        name_cell, _, currency, d120, d90, d60, d30, current, total_due, _phone = row
        try:
            code, person_name, tag = parse_name_cell(name_cell)
            if tag:
                tags_found.append({"code": code, "name": person_name, "tag": tag})
            first_name, last_name = split_person_name(person_name)
            ascii_code = re.sub(r"[^a-z0-9]", "x", code.lower())
            email = f"{ascii_code}@pastel.import.local"

            if frappe.db.exists("Student", {"pastel_account_code": code}):
                student_name_id = frappe.db.get_value("Student", {"pastel_account_code": code}, "name")
            else:
                student_doc = frappe.get_doc({
                    "doctype": "Student",
                    "first_name": first_name,
                    "last_name": last_name,
                    "student_name": person_name,
                    "student_email_id": email,
                    "pastel_account_code": code,
                })
                student_doc.insert(ignore_permissions=True)
                student_name_id = student_doc.name
                created["students"] += 1

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

            existing_fees = frappe.db.exists(
                "Fees", {"student": student_name_id, "fee_structure": FEE_STRUCTURE, "is_opening_balance": 1}
            )
            if not existing_fees:
                fees_doc = frappe.get_doc({
                    "doctype": "Fees",
                    "student": student_name_id,
                    "student_name": person_name,
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
            errors.append({"code": name_cell, "error": str(e)[:300]})

    frappe.db.commit()
    print("RESULT_JSON:" + json.dumps({
        "created": created, "errors": errors, "total_rows": len(student_rows), "tags_found": tags_found
    }, default=str))


run()
