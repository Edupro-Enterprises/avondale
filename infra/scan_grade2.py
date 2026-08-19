import openpyxl
wb = openpyxl.load_workbook("/home/frappe/frappe-bench/Grade2.xlsx", data_only=True)
ws = wb["Sheet1"]

rows = list(ws.iter_rows(min_row=1, values_only=True))
print("total rows:", len(rows))

categories = []
for i, r in enumerate(rows):
    if r[0] and isinstance(r[0], str) and r[0].startswith("Category"):
        categories.append((i, r[0]))
print("categories found:", len(categories))
for c in categories:
    print(c)

# check for any "Total" rows / footer patterns
totals = [(i, r) for i, r in enumerate(rows) if r[0] and isinstance(r[0], str) and 'total' in r[0].lower()]
print("total-like rows:", len(totals))
for t in totals[:10]:
    print(t)
