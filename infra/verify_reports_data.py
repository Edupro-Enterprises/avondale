import frappe, json

def run():
    out = {}
    company = "Avondale Primary School"
    as_on = "2026-08-17"
    from_date = "2026-01-01"

    from edupro_financials.edupro_financials.report.trial_balance.trial_balance import execute as tb
    cols, data = tb({"company": company, "as_on_date": as_on})
    out["trial_balance"] = data
    total_row = [r for r in data if r["account"] == "Total"][0]
    out["trial_balance_balanced"] = abs(total_row["debit"] - total_row["credit"]) < 0.01

    from edupro_financials.edupro_financials.report.mopse_statement_of_financial_position.mopse_statement_of_financial_position import execute as pos
    cols, data = pos({"company": company, "as_on_date": as_on})
    out["position_net_check"] = [r for r in data if "Net Position" in r["account"]]

    from edupro_financials.edupro_financials.report.statement_of_changes_in_net_assets.statement_of_changes_in_net_assets import execute as na
    cols, data = na({"company": company, "from_date": from_date, "to_date": as_on})
    out["net_assets"] = data

    from edupro_financials.edupro_financials.report.cash_flow_statement.cash_flow_statement import execute as cf
    cols, data = cf({"company": company, "from_date": from_date, "to_date": as_on})
    out["cash_flow"] = data

    from edupro_financials.edupro_financials.report.vote_book_variance_statement.vote_book_variance_statement import execute as vb
    cols, data = vb({})
    out["vote_book_variance"] = data

    print("RESULT_JSON:" + json.dumps(out, default=str))

run()
