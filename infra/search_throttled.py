import subprocess
result = subprocess.run(
    ["grep", "-rln", "Throttled", "/home/frappe/frappe-bench/apps/frappe/frappe", "/home/frappe/frappe-bench/apps/erpnext/erpnext", "/home/frappe/frappe-bench/apps/education/education"],
    capture_output=True, text=True
)
print(result.stdout)
print(result.stderr)
