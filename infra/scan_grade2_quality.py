import openpyxl, re
from collections import Counter

wb = openpyxl.load_workbook("/home/frappe/frappe-bench/Grade2.xlsx", data_only=True)
ws = wb["Sheet1"]
rows = list(ws.iter_rows(min_row=1, values_only=True))

cats = [(i, r[0]) for i, r in enumerate(rows) if r[0] and isinstance(r[0], str) and r[0].startswith("Category")]
data_rows = []
for idx, (start, label) in enumerate(cats):
    end = cats[idx+1][0] if idx+1 < len(cats) else len(rows)
    class_code = label.split(" - ")[-1].split("-2026")[0]
    for r in rows[start+1:end]:
        if r[0] and isinstance(r[0], str) and " - " in r[0]:
            data_rows.append((class_code, r))

print("total data rows parsed:", len(data_rows))

currencies = Counter(r[1][2] for r in data_rows)
print("currencies:", currencies)

tags = Counter()
for _, r in data_rows:
    name = r[0]
    for kw in ["BEAM", "STAFF", "HARDSHIP"]:
        if kw in name.upper():
            tags[kw] += 1
print("embedded tags found:", tags)

mismatches = 0
for _, r in data_rows:
    bucket_sum = sum(x or 0 for x in r[1][3:8])
    total = r[1][8]
    if abs(bucket_sum - (total or 0)) > 0.01:
        mismatches += 1
print("bucket-sum mismatches:", mismatches)

# duplicate codes check
codes = [r[1][0].split(" - ")[0].strip() for _, r in data_rows]
dupes = [c for c, n in Counter(codes).items() if n > 1]
print("duplicate codes:", dupes[:20], "total dupes:", len(dupes))

grand_total = sum((r[1][8] or 0) for _, r in data_rows)
print("computed grand total:", grand_total)

class_counts = Counter(c for c, _ in data_rows)
print("class counts:", dict(class_counts))
