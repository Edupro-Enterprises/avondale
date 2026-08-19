import openpyxl
from collections import Counter

wb = openpyxl.load_workbook("/home/frappe/frappe-bench/Grade7_Pastel_Balances_Clean.xlsx", data_only=True)
ws = wb["Grade 7 Balances"]

rows = list(ws.iter_rows(min_row=2, values_only=True))
print("total data rows:", len(rows))

classes = Counter(r[0] for r in rows)
print("classes:", classes)

fee_tags = Counter(r[3] for r in rows)
print("fee_tags:", fee_tags)

flagged = Counter(r[4] for r in rows)
print("flagged:", flagged)

currencies = Counter(r[5] for r in rows)
print("currencies:", currencies)

codes = [r[1] for r in rows]
print("duplicate codes:", [c for c, n in Counter(codes).items() if n > 1])
print("blank codes:", sum(1 for c in codes if not c))
print("blank names:", sum(1 for r in rows if not r[2]))

negative_total = [r for r in rows if r[11] is not None and r[11] < 0]
print("rows with negative Total Due (credit balance):", len(negative_total))
for r in negative_total[:5]:
    print("  ", r)

zero_total = [r for r in rows if r[11] == 0]
print("rows with zero Total Due:", len(zero_total))

# sanity: does Total Due (col 11) == sum of age buckets (cols 6-10)?
mismatches = []
for r in rows:
    bucket_sum = sum(x or 0 for x in r[6:11])
    if abs(bucket_sum - (r[11] or 0)) > 0.01:
        mismatches.append((r[1], r[2], bucket_sum, r[11]))
print("rows where bucket sum != Total Due:", len(mismatches))
for m in mismatches[:5]:
    print("  ", m)
