# print_reports

A reusable, professional financial-document engine for Edupro SMS
(Avondale Primary School and every other tenant on this app) -- Jinja2
templates rendered to PDF for official school financial documents
(receipts, statements, reports).

## Why this exists alongside the app's other two PDF paths

This app already had two working PDF pipelines before this package:

1. **`notifications.py`** -- server-side, wkhtmltopdf-based, generates the
   receipt/invoice PDFs attached to parent emails.
2. **`edupro-theme`'s `export.ts`** -- client-side jsPDF, generates every
   report/statement PDF a user downloads or views in the browser today.

Both stay exactly as they are. `print_reports` is a **third, separate**
module for a specific new requirement: a set of *formal*, letterhead-grade
financial documents (Sage/QuickBooks/Xero-style) with a consistent design
system, built server-side so the same PDF is produced regardless of who
requests it or from where. It reuses those other modules' data helpers
(`notifications._school_letterhead()`, `_outstanding_balance()`,
`_guardian_for_student()`) rather than recomputing anything.

## Why wkhtmltopdf, not WeasyPrint

wkhtmltopdf is already installed in production and already proven on this
exact codebase (see `notifications.py`). WeasyPrint would need a new native
dependency chain (Pango, Cairo, GDK-pixbuf) baked into the Frappe Docker
image and a full rebuild, for no visual-quality gain over what wkhtmltopdf
already produces here. One real constraint to remember: **wkhtmltopdf's
WebKit engine does not support CSS flexbox or grid** -- `styles.css` uses
`display: table` / `table-cell` throughout instead (the same fix already
applied to the email receipt/invoice templates this session).

Page numbering is *not* done via CSS `@page` counters -- wkhtmltopdf does
not render those reliably. A multi-page report should instead pass
`wkhtmltopdf_options={"footer-center": "Page [page] of [topage]", ...}`
into `pdf_service.generate_pdf()`, which forwards it straight to
`frappe.utils.pdf.get_pdf()`'s own `options` argument.

**Confirmed live**: CSS `@page { size: A5 }` is also ignored by
wkhtmltopdf -- the first sample PDF rendered at its default page size
instead. Page size/orientation for a given report must be set through
that same `wkhtmltopdf_options` dict (`page-width`/`page-height` or
`page-size`/`orientation`), not CSS -- see `api.py`'s
`RECEIPT_PDF_OPTIONS` for the working pattern.

**Confirmed live**: combining wkhtmltopdf's native `footer-center` option
with this package's own in-HTML footer (`print_footer.html`) produced a
wholly blank trailing page on every generic report, even single-page ones
-- the two footers appear to fight over the same reserved margin space.
`GENERIC_REPORT_PDF_OPTIONS` currently has no `footer-center`, so reports
have no "Page X of Y" numbering yet. Fixing that properly (so a real
multi-page report gets numbering back without the blank-page bug) is a
follow-up, not done in this pass -- don't re-add `footer-center` without
re-testing against a report with 20+ rows to see whether the interaction
survives with real pagination.

## Structure

```
print_reports/
├── templates/
│   ├── base/
│   │   ├── base_report.html   # {% block header/content/signatures %}
│   │   ├── print_header.html  # branding (left) + doc title/meta (right)
│   │   ├── print_footer.html  # generation timestamp, sample banner
│   │   └── styles.css         # the whole design system, one file
│   ├── financial/
│   │   └── receipt.html       # Report 8: Official Payment Receipt (A5)
│   └── components/
│       ├── signatures.html    # signature_block() macro
│       └── summary_cards.html # summary_cards() macro
├── services/
│   ├── branding_service.py    # get_school_branding() -> SchoolBranding
│   ├── report_service.py      # get_receipt_context(name) -> (ctx, qr)
│   └── pdf_service.py         # render_html() / generate_pdf()
├── schemas/
│   └── financial_reports.py   # SchoolBranding, ReceiptContext, ...
├── tests/
│   └── test_receipt_report.py
└── api.py                     # @frappe.whitelist() entry points
```

## Adding a new report

1. Add its typed context dataclass to `schemas/financial_reports.py`.
2. Add a `get_<report>_context(...)` function to `services/report_service.py`
   that pulls data from the app's *existing* doctypes/reports.py functions
   -- never recompute a figure that already has an owner.
3. Add `templates/financial/<report>.html`, extending
   `base/base_report.html` and using the `components/` macros where they
   fit. Reuse `styles.css` classes (`.financial-table`, `.summary-cards`,
   `.meta-strip`, `.status-pill`) instead of inventing new ones.
4. Add a whitelisted function to `api.py` that builds context, calls
   `pdf_service.generate_pdf()`, and streams the result the same way
   `generate_receipt_pdf()` does.
5. Add a test in `tests/`, following `test_receipt_report.py`'s pattern.

## Security & permissions

- Every context-builder in `report_service.py` calls
  `frappe.has_permission()` on the underlying document -- there is no
  separate role list invented for printing; if you can't read the Receipt/
  Invoice/etc. in the app, you can't print it either.
- `generate_receipt_pdf` refuses to print an unsubmitted (`docstatus != 1`)
  Receipt -- an official document is only issued for a real, recorded
  payment, never a draft.
- `pdf_service.generate_pdf()` logs only the template name and exception
  type on failure (`frappe.log_error`), never the rendered HTML or context
  -- that would put student names and amounts into the error log.
- School branding fields (`school_name`, `logo`, `registration_number`,
  etc.) come only from the real School Setup doctype via
  `notifications._school_letterhead()`. Nothing here invents a motto,
  website, or contact detail School Setup doesn't actually store --
  a missing field is simply omitted from the printed document.

## Running the tests

```bash
bench --site <site> run-tests --app edupro_school_fees --module edupro_school_fees.print_reports.tests.test_receipt_report
bench --site <site> run-tests --app edupro_school_fees --module edupro_school_fees.print_reports.tests.test_new_reports
```

## Status

**Built, deployed, and verified against real production data (generated
sample PDFs, not just rendered HTML):**

- Official Payment Receipt (`generate_receipt_pdf`) -- A5, QR verification
  code pointing at `https://fees.edupro.co.zw/verify-receipt`.
- Daily Cash Collection, Payment Summary, Outstanding Fees, Income &
  Expenditure, Statement of Financial Position, Bursar Cashbook, Statement
  of Receipts and Payments, Ledger (Trial Balance), Fixed Assets Register,
  Termly Fee Collection -- all via `generate_financial_report_pdf(report_key, ...)`.
- Student Fee Statement (`generate_student_statement_pdf`) -- includes
  School Banking Details and the documented balance convention.

**Built, but not yet deployed or verified against a live bench** (no bench
was available in the environment this was written in -- syntax-checked and
code-reviewed, but never actually run through `bench run-tests` or
rendered into a real PDF; run the test module above before trusting these
in production):

- Bank Reconciliation Report, Budget Vote Book Variance Report, BEAM
  Reconciliation Report -- all via `generate_financial_report_pdf(report_key, ...)`
  with `report_key` one of `bank-reconciliation`, `budget-variance`,
  `beam-reconciliation`. Bank Reconciliation and Budget Variance read
  their doctypes directly (native-currency amounts converted to USD via
  `utils.get_exchange_rate`/`convert_amount`, the same convention as every
  other report here); BEAM Reconciliation reshapes
  `beam_claim.get_beam_reconciliation()`'s existing output rather than
  re-deriving the unpaid-claim math.
- MoPSE ED46 Return (`generate_ed46_return_pdf(name)`) -- its own
  `financial/ed46_return.html` template (a fixed-layout regulatory form,
  not a tabular report), with a three-way Bursar/School Head/SDC
  Chairperson signature block reflecting each doctype's own
  `*_certified` flags.

None of the four above are wired into the edupro-theme frontend yet --
their pages (`bursar/reports/bank-reconciliation.tsx`,
`bursar/reports/variance.tsx`, `bursar/reports/beam.tsx`,
`bursar/reports/mopse-ed46.tsx`) still only have their original
client-side jsPDF export, if any (variance.tsx and bank-reconciliation.tsx
do via `ReportActions`; beam.tsx and mopse-ed46.tsx currently have none).
Wiring a "Print official PDF" button on these pages to
`generate_financial_report_pdf`/`generate_ed46_return_pdf` is a real
follow-up, not done here -- none of the *other* 10 already-built reports
are wired into the frontend either, so there's no existing pattern this
extends; it would be a first, separate integration pass.

**Known gap, attempted but not re-verified**: reports previously had no
"Page X of Y" numbering -- wkhtmltopdf's native `--footer-center "Page
[page] of [topage]"` option produced a blank trailing page when combined
with this package's own in-HTML footer. `GENERIC_REPORT_PDF_OPTIONS` now
sets `footer-right: "Page [page]"` (page number only, deliberately
*without* `[topage]`, since forcing wkhtmltopdf's two-pass render for the
total-page-count placeholder is the most likely trigger for the original
blank-page bug) plus a larger `margin-bottom` and explicit
`footer-spacing` so the native footer has real reserved space instead of
colliding with `print_footer.html`'s own trailing content. **This has not
been re-tested against a real multi-page report** -- no bench was
available. Generate Outstanding Fees (~69 pages on real data) as a real
PDF and check for a stray blank page before trusting this. Upgrading to
`"Page [page] of [topage]"` once that's confirmed safe is a further
follow-up.
