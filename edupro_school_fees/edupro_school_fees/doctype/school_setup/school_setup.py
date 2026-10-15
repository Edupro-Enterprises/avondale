# Copyright (c) 2024, Edupro and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


@frappe.whitelist(allow_guest=True)
def get_school_branding():
	"""School name + logo only, for the sign-in page and every shell's sidebar
	header -- School Setup's own DocPerm only grants read to System Manager/
	School Head/Bursar (it also holds banking_configuration and other
	sensitive fields), but the school's name and logo are meant to be visible
	branding, not restricted data, and the sign-in page needs them before
	any session exists. Deliberately bypasses DocPerm via frappe.db.get_value
	rather than frappe.get_doc, and only ever returns these two fields."""
	row = frappe.db.get_value("School Setup", filters={}, fieldname=["school_name", "school_logo"], as_dict=True)
	return row or {}


class SchoolSetup(Document):
    def validate(self):
        self.validate_single_instance()
        self.validate_banking_configuration()
    
    def validate_single_instance(self):
        """Ensure School Setup can only be created once per site"""
        if not self.is_new():
            return
        
        existing = frappe.db.exists("School Setup", {"name": ("!=", self.name)})
        if existing:
            frappe.throw(
                "School Setup already exists. Only one School Setup is allowed per site.",
                title="Duplicate School Setup"
            )
    
    def validate_banking_configuration(self):
        """Validate banking configuration completeness"""
        if not self.banking_configuration:
            frappe.throw("At least one bank account configuration is required.", title="Banking Configuration Required")
        
        # Check for at least one Tuition and one Levy/SDC account
        fee_streams = [row.fee_stream for row in self.banking_configuration if row.is_active]
        
        if "Tuition" not in fee_streams:
            frappe.throw("At least one active Tuition account is required.", title="Missing Tuition Account")
        
        if "Levy/SDC" not in fee_streams:
            frappe.throw("At least one active Levy/SDC account is required.", title="Missing Levy/SDC Account")
        
        # Check that both ZiG and FCA accounts exist for each fee stream
        for stream in ["Tuition", "Levy/SDC", "Boarding", "Project"]:
            stream_accounts = [row for row in self.banking_configuration if row.fee_stream == stream and row.is_active]
            
            if stream_accounts:
                currencies = set([row.currency_type for row in stream_accounts])
                
                if "ZiG" not in currencies:
                    frappe.throw(f"At least one ZiG account is required for {stream} fee stream.", title=f"Missing ZiG Account for {stream}")
                
                if "FCA" not in currencies:
                    frappe.throw(f"At least one FCA account is required for {stream} fee stream.", title=f"Missing FCA Account for {stream}")
        
        # Validate each banking entry
        for row in self.banking_configuration:
            if row.is_active:
                if not row.bank_name or not row.account_name or not row.account_number:
                    frappe.throw("Bank Name, Account Name, and Account Number are required for active accounts.", title="Incomplete Banking Information")
    
    def before_save(self):
        """Generate default Chart of Accounts on first save. Default Academic Year
        bootstrapping is install.py's job (after_install) -- not duplicated here."""
        self.generate_chart_of_accounts()
        self.sync_payment_methods()

    def sync_payment_methods(self):
        """DEF-004: the banking wizard's rows used to be purely descriptive --
        nothing tied them to the Payment Method records the receipting engine
        (utils.py's create_journal_entry_for_receipt) actually posts against,
        so a Bursar configuring "correct" bank accounts here had no guarantee
        receipts ever touched them. For every active row with its Ledger
        Account filled in, ensure a matching Payment Method exists (create it
        if not) so the two stay connected. Rows without an account are left
        alone -- this must never retroactively break a School Setup singleton
        saved before this field existed."""
        currency_map = {"ZiG": "ZiG", "FCA": "USD"}
        for row in self.banking_configuration:
            if not row.is_active or not row.account:
                continue
            method_name = f"{row.bank_name} - {row.fee_stream} ({row.currency_type})"
            if frappe.db.exists("Payment Method", method_name):
                continue
            frappe.get_doc({
                "doctype": "Payment Method",
                "method_name": method_name,
                "method_type": "Bank Transfer",
                "account": row.account,
                "currency": currency_map.get(row.currency_type, "ZiG"),
            }).insert(ignore_permissions=True)

    def generate_chart_of_accounts(self):
        """Generate a default Chart of Accounts using this app's own Account schema
        (account_name/account_type/fund/currency/parent_account/is_group) -- no
        ERPNext Company/report_type dependency (this app doesn't require ERPNext,
        see hooks.py's required_apps = []).

        "Debtors" (Asset) and "Fees Income" (Income) are load-bearing exact names --
        utils.py's create_journal_entry_for_invoice looks them up by
        account_type/account_name and throws if either is missing.
        """
        fund_a = "Fund A - General/Government"
        fund_b = "Fund B - SDC/SDA"

        # (account_name, account_type, is_group, parent_account, fund, currency)
        default_accounts = [
            ("Assets", "Asset", 1, None, fund_a, "ZiG"),
            ("Liabilities", "Liability", 1, None, fund_a, "ZiG"),
            ("Income", "Income", 1, None, fund_a, "ZiG"),
            ("Expenses", "Expense", 1, None, fund_a, "ZiG"),
            ("Equity", "Equity", 1, None, fund_a, "ZiG"),

            # Assets
            ("Bank Accounts", "Asset", 1, "Assets", fund_a, "ZiG"),
            ("Bank - ZiG", "Asset", 0, "Bank Accounts", fund_a, "ZiG"),
            ("Bank - FCA", "Asset", 0, "Bank Accounts", fund_a, "USD"),
            ("Cash-in-Till", "Asset", 0, "Assets", fund_a, "ZiG"),
            ("Debtors", "Asset", 0, "Assets", fund_a, "ZiG"),
            # DEF-005: Fund B (SDC) used to get no bank/cash account of its own --
            # a school going live on these defaults had no way to record an SDC
            # disbursement without first manually creating Fund B accounts (and
            # nothing then stopped those from being mistakenly tagged Fund A).
            ("Bank - SDC", "Asset", 0, "Bank Accounts", fund_b, "ZiG"),
            ("SDC Cash-in-Till", "Asset", 0, "Assets", fund_b, "ZiG"),

            # Liabilities
            ("Accounts Payable", "Liability", 1, "Liabilities", fund_a, "ZiG"),
            ("Student Deposits", "Liability", 0, "Liabilities", fund_a, "ZiG"),
            ("Unearned Revenue", "Liability", 0, "Liabilities", fund_a, "ZiG"),

            # Income -- Fees Income stays a single leaf account (matches utils.py's
            # hardcoded lookup); the other streams are separate sibling leaves rather
            # than children of it, so posting against "Fees Income" itself is valid.
            ("Fees Income", "Income", 0, "Income", fund_a, "ZiG"),
            ("Levy/SDC Fees Income", "Income", 0, "Income", fund_b, "ZiG"),
            ("Boarding Fees Income", "Income", 0, "Income", fund_a, "ZiG"),
            ("Project Fees Income", "Income", 0, "Income", fund_b, "ZiG"),
            ("Other Income", "Income", 0, "Income", fund_a, "ZiG"),
            ("Application Fees Income", "Income", 0, "Income", fund_a, "ZiG"),

            # Expenses
            ("Salaries", "Expense", 0, "Expenses", fund_a, "ZiG"),
            ("Utilities", "Expense", 0, "Expenses", fund_a, "ZiG"),
            ("Maintenance", "Expense", 0, "Expenses", fund_a, "ZiG"),
            ("Educational Materials", "Expense", 0, "Expenses", fund_a, "ZiG"),
            ("Administrative Expenses", "Expense", 0, "Expenses", fund_a, "ZiG"),
            ("Bad Debts Written Off", "Expense", 0, "Expenses", fund_a, "ZiG"),
            ("SDC Project Expenses", "Expense", 0, "Expenses", fund_b, "ZiG"),
            ("SDC Maintenance", "Expense", 0, "Expenses", fund_b, "ZiG"),
            ("SDC Administrative Expenses", "Expense", 0, "Expenses", fund_b, "ZiG"),

            # Equity
            ("Accumulated Fund", "Equity", 0, "Equity", fund_a, "ZiG"),
        ]

        for account_name, account_type, is_group, parent_account, fund, currency in default_accounts:
            if frappe.db.exists("Account", account_name):
                continue
            frappe.get_doc({
                "doctype": "Account",
                "account_name": account_name,
                "account_type": account_type,
                "is_group": is_group,
                "parent_account": parent_account,
                "fund": fund,
                "currency": currency,
            }).insert(ignore_permissions=True)
