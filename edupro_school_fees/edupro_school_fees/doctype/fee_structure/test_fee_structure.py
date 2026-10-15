"""Focused unit tests for the Fee Structure governance gate -- isolating edge cases not
already covered by test_invoice.py's end-to-end happy path."""

import frappe
from frappe.tests.utils import FrappeTestCase


class TestFeeStructure(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self._grant_workflow_roles()

	def _grant_workflow_roles(self):
		# The Fee Structure Workflow now genuinely enforces its own transitions
		# (Draft -> Pending Approval needs Bursar, Pending Approval -> Approved
		# needs Fees Approver) -- Administrator has neither role by default.
		user = frappe.get_doc("User", "Administrator")
		existing = {r.role for r in user.roles}
		missing = [r for r in ("Bursar", "Fees Approver") if r not in existing]
		if missing:
			for role in missing:
				user.append("roles", {"role": role})
			user.save(ignore_permissions=True)

	def _make_prereqs(self, suffix):
		if not frappe.db.exists("Account", "Fees Income"):
			frappe.get_doc({"doctype": "Account", "account_name": "Fees Income", "account_type": "Income", "currency": "ZiG"}).insert()

		academic_year = frappe.get_doc({
			"doctype": "Academic Year",
			"academic_year_name": f"FS Test Year {suffix}",
			"start_date": "2027-01-01",
			"end_date": "2027-12-31",
		}).insert()
		term = frappe.get_all("Term", filters={"academic_year": academic_year.name}, limit=1)[0]
		fee_item = frappe.get_doc({
			"doctype": "Fee Item",
			"item_name": f"FS Test Fee Item {suffix}",
			"default_amount": 50,
			"account": "Fees Income",
		}).insert()
		return academic_year, term, fee_item

	def _make_draft_fee_structure(self, suffix):
		academic_year, term, fee_item = self._make_prereqs(suffix)
		return frappe.get_doc({
			"doctype": "Fee Structure",
			"structure_name": f"FS Test Structure {suffix}",
			"academic_year": academic_year.name,
			"term": term.name,
			"items": [{"fee_item": fee_item.name, "amount": 50}],
		}).insert()

	def test_approval_blocked_with_only_agm_minutes(self):
		fs = self._make_draft_fee_structure("A")
		fs.agm_minutes = "/files/agm_only.pdf"
		fs.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			fs.save()

	def test_approval_blocked_with_only_mopse_letter(self):
		fs = self._make_draft_fee_structure("B")
		fs.mopse_approval_letter = "/files/mopse_only.pdf"
		fs.workflow_state = "Approved"
		with self.assertRaises(frappe.ValidationError):
			fs.save()

	def test_approved_fee_structure_items_locked(self):
		fs = self._make_draft_fee_structure("C")
		fs.agm_minutes = "/files/agm.pdf"
		fs.mopse_approval_letter = "/files/mopse.pdf"
		# The workflow only allows Draft -> Pending Approval -> Approved, not a
		# direct jump -- go through both hops.
		fs.workflow_state = "Pending Approval"
		fs.save()
		self._co_sign(fs)
		fs.workflow_state = "Approved"
		fs.save()

		fs.reload()
		fs.items[0].amount = 999
		with self.assertRaises(frappe.ValidationError):
			fs.save()

	def _make_real_file(self, content, filename):
		return frappe.get_doc({
			"doctype": "File", "file_name": filename, "is_private": 1, "content": content,
		}).insert(ignore_permissions=True)

	def _make_user(self, email, role):
		if not frappe.db.exists("User", email):
			user = frappe.get_doc({
				"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0,
			}).insert(ignore_permissions=True)
		else:
			user = frappe.get_doc("User", email)
		if not any(r.role == role for r in user.roles):
			user.append("roles", {"role": role})
			user.save(ignore_permissions=True)
		return email

	def _co_sign(self, fs):
		from edupro_school_fees.edupro_school_fees.doctype.fee_structure.fee_structure import co_sign_fee_structure

		head = self._make_user("fs-head@rbac.test", "School Head")
		sdc = self._make_user("fs-sdc@rbac.test", "SDC Chairperson/Treasurer")
		current_user = frappe.session.user
		frappe.set_user(head)
		co_sign_fee_structure(fs.name)
		frappe.set_user(sdc)
		co_sign_fee_structure(fs.name)
		frappe.set_user(current_user)
		fs.reload()

	def _approve(self, fs):
		fs.workflow_state = "Pending Approval"
		fs.save()
		self._co_sign(fs)
		fs.workflow_state = "Approved"
		fs.save()
		return fs

	def test_document_hash_computed_from_real_attachment(self):
		fs = self._make_draft_fee_structure("D")
		# Frappe's own File.before_insert() security scan (check_content -> pdf_contains_js)
		# infers file_type == "PDF" from the filename and runs pypdf against real content --
		# these fixtures only need to exercise _hash_attached_file(), which reads raw bytes
		# regardless of type, so a non-PDF extension avoids that unrelated scan.
		agm_file = self._make_real_file("AGM minutes content D", "agm_d.txt")
		mopse_file = self._make_real_file("MoPSE letter content D", "mopse_d.txt")
		fs.agm_minutes = agm_file.file_url
		fs.mopse_approval_letter = mopse_file.file_url
		self._approve(fs)

		self.assertTrue(fs.agm_minutes_hash)
		self.assertTrue(fs.mopse_approval_letter_hash)
		self.assertNotEqual(fs.agm_minutes_hash, fs.mopse_approval_letter_hash)

		import hashlib
		self.assertEqual(fs.agm_minutes_hash, hashlib.sha256(b"AGM minutes content D").hexdigest())

	def test_approved_fee_structure_header_fields_locked(self):
		fs = self._make_draft_fee_structure("E")
		fs.agm_minutes = "/files/agm_e.pdf"
		fs.mopse_approval_letter = "/files/mopse_e.pdf"
		self._approve(fs)

		fs.reload()
		fs.structure_name = "Renamed"
		with self.assertRaises(frappe.ValidationError):
			fs.save()

	def test_create_revision_and_approval_marks_original_superseded(self):
		from edupro_school_fees.edupro_school_fees.doctype.fee_structure.fee_structure import create_revision

		fs = self._make_draft_fee_structure("F")
		fs.agm_minutes = "/files/agm_f.pdf"
		fs.mopse_approval_letter = "/files/mopse_f.pdf"
		self._approve(fs)

		revision_name = create_revision(fs.name)
		revision = frappe.get_doc("Fee Structure", revision_name)
		self.assertEqual(revision.revision_of, fs.name)
		self.assertEqual(revision.workflow_state, "Draft")
		self.assertEqual(revision.items[0].fee_item, fs.items[0].fee_item)

		revision.agm_minutes = "/files/agm_f_v2.pdf"
		revision.mopse_approval_letter = "/files/mopse_f_v2.pdf"
		self._approve(revision)

		fs.reload()
		self.assertEqual(fs.superseded_by, revision_name)

	def test_cannot_revise_a_structure_twice(self):
		from edupro_school_fees.edupro_school_fees.doctype.fee_structure.fee_structure import create_revision

		fs = self._make_draft_fee_structure("G")
		fs.agm_minutes = "/files/agm_g.pdf"
		fs.mopse_approval_letter = "/files/mopse_g.pdf"
		self._approve(fs)

		first_revision = create_revision(fs.name)
		revision = frappe.get_doc("Fee Structure", first_revision)
		revision.agm_minutes = "/files/agm_g_v2.pdf"
		revision.mopse_approval_letter = "/files/mopse_g_v2.pdf"
		self._approve(revision)

		with self.assertRaises(frappe.ValidationError):
			create_revision(fs.name)
