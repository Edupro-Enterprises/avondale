# ADR 0019: Comprehensive student records, fee structure versioning, and school setup wizard

## Status

Accepted.

## Context

Five "Onboarding & records" gaps from the readiness report, requested together:
no School Setup Wizard UI (the frontend was still a `ComingSoon` stub even
though the backend `School Setup` doctype and its APIs already existed);
`Student` carried none of the guardian legal-custody/employer, medical, SEN,
academic-history, disciplinary, or transfer-history fields the spec expects;
none of BEAM vulnerability classification, boarder/hostel/bus/lunch-scheme
fields existed either; a new `Invoice` never picked up a student's unpaid
balance from a prior term; and Fee Structure's "revision" story was really
just an edit-lock with no actual version chain, and neither AGM minutes nor
the MoPSE approval letter had any tamper-evidence on them.

## Decisions

**Document-integrity hashing reuses the existing `portal_invitations.py`
convention** (`hashlib.sha256(...).hexdigest()`) rather than introducing a new
scheme. `Fee Structure.agm_minutes_hash`/`mopse_approval_letter_hash` are
computed in `validate()` whenever the corresponding attachment field actually
changes, reading real file content via `frappe.get_doc("File", ...).get_content()`
-- not the attachment's file name or metadata, so the hash is tied to what was
actually uploaded, not what it's called.

**Fee Structure revisions are a real version chain, not an edit-lock.**
`create_revision()` clones an Approved structure into a fresh Draft carrying
`revision_of`; once that revision itself reaches Approved, the original is
stamped `superseded_by`. The header fields that identify what was approved
(`structure_name`, `academic_year`, `term`, `beneficiary_category`,
`agm_minutes`, `mopse_approval_letter`) and the line items are all locked on
an Approved structure via `on_update()`'s diff against
`get_doc_before_save()` -- `create_revision()` is the only sanctioned way to
change an Approved structure's figures.

**The revision's `structure_name` gets a timestamp suffix
(`f"{original.structure_name} (Rev {timestamp})"`) instead of reusing the
original's verbatim.** Fee Structure's own `autoname` is
`format:{academic_year}-{term}-{structure_name}` -- a revision deliberately
keeps the same `academic_year`/`term`/`beneficiary_category` as the original
for continuity, so `structure_name` is the only one of those three fields a
revision can vary without computing an identical primary key to the very
record it revises. This surfaced as a real `IntegrityError 1062` in testing,
not a hypothetical.

**A new invoice for a student with unpaid prior balances gets a "Balance
Brought Forward" line automatically**, added in `before_insert()` and summing
every prior submitted, non-Consolidated invoice's `outstanding_amount` for
that student. The prior invoices are then flipped to a new `Consolidated`
status with their `outstanding_amount` zeroed via direct `frappe.db.set_value`
in `after_insert()` -- deliberately bypassing `validate()`, the same pattern
Receipt already uses for its own reversal status flip. **The brought-forward
line is excluded from the new invoice's revenue-recognition Journal
Entry** (`is_brought_forward` Check flag on `Invoice Line`, filtered out in
`create_journal_entry_for_invoice`) -- the income and Debtors movement for
that money were already posted when the original invoice was submitted;
recognising it again here would double-count both.

**`Student` grows by addition, not restructuring** -- BEAM vulnerability
classification and district social welfare reference, boarder/hostel/bus/
lunch-scheme fields, a second guardian link plus court-order-on-file and
legal-guardian-designation, a medical profile (blood group, allergies,
chronic conditions, medications, emergency contact), SEN flag and notes,
three new child tables (`Student Report Card`, `Student Activity`, `Student
Disciplinary Record`), and departure/transfer tracking (destination school,
transfer reason, clearance certificate number). `status` gained `Suspended`,
`Transferred Out`, `Deceased`, and `Graduated` alongside the existing
`Active`/`Withdrawn`. Every new child doctype ships its own trivial
`class X(Document): pass` controller file -- a child doctype with none of
these fails `bench migrate` with an `ImportError`, a gotcha already hit once
this session for `Cash Up Line`.

**The School Setup Wizard is now a real multi-card form**, not the
`ComingSoon` placeholder -- School Information, Address & Contact, Banking
Configuration (dynamic rows), Fund Names & Cash Office, and Receipt &
Statement Text, calling the `School Setup` doctype's existing
`getSchoolSetup()`/`saveSchoolSetup()` APIs (already built, just never
wired to a frontend) plus new `listDistricts()`/`listRegions()` lookups.
Handles both the create path (no record yet -- System Manager only, per the
existing backend permission) and the edit path (Bursar/School Head) in one
screen.

## Consequences

- **Two bugs surfaced during testing and were fixed before this shipped**:
  the autoname collision above, and a test-fixture bug where
  `_make_real_file()` used a `.pdf` filename with plain-text content --
  Frappe's own `File.before_insert()` infers `file_type == "PDF"` from the
  filename and ran `pypdf` against it for its unrelated JS-in-PDF security
  scan. Renamed the fixtures to `.txt`; `_hash_attached_file()` itself never
  inspects file type, so production behaviour was never affected, only the
  test.
- **No de-duplication or reconciliation of carried-forward balances against
  a student who transfers schools mid-carry** -- the brought-forward line is
  purely additive per student; nothing here handles a `Transferred Out`
  student's residual balance.
- **`Student Report Card`/`Student Activity`/`Student Disciplinary Record`
  have no dedicated permission scoping of their own yet** beyond whatever the
  parent `Student` doctype's DocPerm and portal RBAC already grant -- a
  Parent/Guardian portal user sees these child rows exactly as they see the
  rest of their own child's Student record, nothing narrower.
- Full test suite: 151 tests (up from ~145 before this phase), verified twice
  against the final rebuilt production image -- once via `bench migrate` and
  once via the full `run-tests` run immediately after backend and frontend
  redeploy.
