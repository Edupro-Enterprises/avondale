import openpyxl
wb = openpyxl.load_workbook("/home/frappe/frappe-bench/Grade2.xlsx", data_only=True)
ws = wb["Sheet1"]
rows = list(ws.iter_rows(min_row=1, values_only=True))

cat_bounds = []
cats = [(i, r[0]) for i, r in enumerate(rows) if r[0] and isinstance(r[0], str) and r[0].startswith("Category")]
for idx, (start, label) in enumerate(cats):
    end = cats[idx+1][0] if idx+1 < len(cats) else len(rows)
    section = rows[start+1:end]
    data_rows = [r for r in section if r[0] and not (isinstance(r[0], str) and r[0].strip()=='')]
    print(label, "-> rows in section:", len(section), "non-blank first-col rows:", len(data_rows))
    # show last 2 rows of section to check for subtotal pattern
    for r in section[-2:]:
        print("   ", r)
