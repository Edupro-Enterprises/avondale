import frappe
from frappe.tests.utils import FrappeTestCase

from edupro_school_fees.utils import run_asset_depreciation


class TestAsset(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def _make_accounts(self, suffix):
		expense = f"Asset Test Depreciation Expense {suffix}"
		accumulated = f"Asset Test Accumulated Depreciation {suffix}"
		if not frappe.db.exists("Account", expense):
			frappe.get_doc({"doctype": "Account", "account_name": expense, "account_type": "Expense", "currency": "ZiG"}).insert()
		if not frappe.db.exists("Account", accumulated):
			frappe.get_doc({"doctype": "Account", "account_name": accumulated, "account_type": "Asset", "currency": "ZiG"}).insert()
		return expense, accumulated

	def _make_asset(self, suffix, historical_cost=1200, depreciation_rate=12):
		expense, accumulated = self._make_accounts(suffix)
		return frappe.get_doc({
			"doctype": "Asset",
			"asset_code": f"AST-TEST-{suffix}",
			"description": f"Test Asset {suffix}",
			"date_acquired": "2026-01-01",
			"historical_cost": historical_cost,
			"currency": "ZiG",
			"depreciation_rate": depreciation_rate,
			"depreciation_expense_account": expense,
			"accumulated_depreciation_account": accumulated,
		}).insert()

	def test_net_book_value_computed_on_save(self):
		asset = self._make_asset("A", historical_cost=1000)
		self.assertEqual(asset.net_book_value, 1000)

		frappe.db.set_value("Asset", asset.name, "accumulated_depreciation", 300)
		asset.reload()
		asset.description = "Updated description"
		asset.save()
		self.assertEqual(asset.net_book_value, 700)

	def test_disposal_requires_disposal_date(self):
		asset = self._make_asset("B")
		asset.disposal_status = "Disposed"
		with self.assertRaises(frappe.ValidationError):
			asset.save()

	def test_disposal_with_date_succeeds(self):
		asset = self._make_asset("C")
		asset.disposal_status = "Disposed"
		asset.disposal_date = "2026-06-01"
		asset.save()
		self.assertEqual(asset.disposal_status, "Disposed")

	def test_run_asset_depreciation_posts_journal_entry(self):
		# 12% p.a. on 1200 = 144/year = 12/month.
		asset = self._make_asset("D", historical_cost=1200, depreciation_rate=12)
		run_asset_depreciation()

		asset.reload()
		self.assertEqual(asset.accumulated_depreciation, 12)
		self.assertEqual(asset.net_book_value, 1188)

		je_name = frappe.db.get_value("Journal Entry", {"reference_doctype": "Asset", "reference_name": asset.name}, "name")
		self.assertTrue(je_name)
		je = frappe.get_doc("Journal Entry", je_name)
		self.assertEqual(je.total_debit, 12)
		self.assertEqual(je.total_credit, 12)

	def test_run_asset_depreciation_caps_at_historical_cost(self):
		asset = self._make_asset("E", historical_cost=100, depreciation_rate=1200)  # absurdly high rate
		frappe.db.set_value("Asset", asset.name, "accumulated_depreciation", 95)
		run_asset_depreciation()

		asset.reload()
		self.assertEqual(asset.accumulated_depreciation, 100)
		self.assertEqual(asset.net_book_value, 0)

	def test_fixed_assets_disposal_register(self):
		# DEF-013: the Fixed Assets/PRAZ Disposal Register was the one named
		# statutory report with no implementing function at all.
		from edupro_school_fees.statutory_reports_extra import get_fixed_assets_disposal_register

		in_use = self._make_asset("G", historical_cost=500)
		disposed = self._make_asset("H", historical_cost=300)
		disposed.disposal_status = "Disposed"
		disposed.disposal_date = "2026-06-01"
		disposed.disposal_praz_reference = "PRAZ-DISP-001"
		disposed.save()

		result = get_fixed_assets_disposal_register()
		codes = {a["asset_code"] for a in result["assets"]}
		self.assertIn(in_use.name, codes)
		self.assertIn(disposed.name, codes)

		disposal_codes = {d["asset_code"] for d in result["disposals"]}
		self.assertIn(disposed.name, disposal_codes)
		self.assertNotIn(in_use.name, disposal_codes)

		disposal_row = next(d for d in result["disposals"] if d["asset_code"] == disposed.name)
		self.assertEqual(disposal_row["disposal_praz_reference"], "PRAZ-DISP-001")

	def test_disposed_asset_excluded_from_depreciation(self):
		asset = self._make_asset("F", historical_cost=1000, depreciation_rate=10)
		asset.disposal_status = "Disposed"
		asset.disposal_date = "2026-06-01"
		asset.save()

		run_asset_depreciation()

		asset.reload()
		self.assertEqual(asset.accumulated_depreciation, 0)
