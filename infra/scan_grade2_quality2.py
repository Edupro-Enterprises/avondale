import openpyxl
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

mismatches = 0
for class_code, r in data_rows:
    bucket_sum = sum(x or 0 for x in r[3:8])
    total = r[8]
    if abs(bucket_sum - (total or 0)) > 0.01:
        mismatches += 1
        if mismatches <= 5:
            print("MISMATCH:", class_code, r)
print("bucket-sum mismatches:", mismatches, "/", len(data_rows))

codes = [r[0].split(" - ")[0].strip() for _, r in data_rows]
dupes = [c for c, n in Counter(codes).items() if n > 1]
print("duplicate codes:", dupes[:20], "total dupes:", len(dupes))

grand_total = sum((r[8] or 0) for _, r in data_rows)
print("computed grand total:", grand_total, "(file's own grand total row said 88967.29)")

class_counts = Counter(c for c, _ in data_rows)
for k, v in sorted(class_counts.items()):
    print(" ", k, v)

negatives = [(c, r[0], r[8]) for c, r in data_rows if (r[8] or 0) < 0]
print("negative total-due rows:", len(negatives))
for n in negatives[:5]:
    print("  ", n)
