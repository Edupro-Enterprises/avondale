"""PDFGenerationService.

Renders one of this package's Jinja2 templates and turns it into a PDF via
frappe.utils.pdf.get_pdf(), which shells out to wkhtmltopdf -- the engine
already installed and proven in this app (see notifications.py's receipt/
invoice emails). Deliberately NOT WeasyPrint: it isn't installed, and
adding it would mean a new native dependency chain (Pango/Cairo/GDK-pixbuf)
baked into the production Docker image, for no visual-quality gain over
the wkhtmltopdf pipeline this app already runs.

Uses a plain jinja2.Environment with its own FileSystemLoader rooted at
this package's templates/ directory, rather than frappe.render_template()
-- gives {% extends %}/{% include %} predictable, simple path resolution
against a folder this package fully owns, and needs no new dependency
(jinja2 already ships with Frappe).
"""

import os

import frappe
import jinja2
from frappe.utils.pdf import get_pdf as _get_pdf

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(TEMPLATES_DIR),
    autoescape=jinja2.select_autoescape(["html"]),
)


class ReportTemplateError(Exception):
    """Raised for a missing template or missing required context -- callers
    should treat this as a caller bug, not surface it to the end user
    as-is (it may name an internal template path)."""


def render_html(template_name: str, context: dict) -> str:
    try:
        template = _env.get_template(template_name)
    except jinja2.TemplateNotFound as e:
        raise ReportTemplateError(f"Unknown report template: {template_name}") from e

    try:
        return template.render(**context)
    except jinja2.UndefinedError as e:
        # Jinja's own message names the missing attribute, not any actual
        # financial data -- safe to log and re-raise as-is.
        raise ReportTemplateError(f"Template {template_name} is missing required context: {e}") from e


def generate_pdf(template_name: str, context: dict, output_path: str | None = None, wkhtmltopdf_options: dict | None = None):
    """Renders `template_name` with `context` and returns PDF bytes, or --
    when `output_path` is given -- writes the PDF there and returns that
    path instead. `wkhtmltopdf_options` passes straight through to
    frappe.utils.pdf.get_pdf's own `options` dict (e.g. footer/page-number
    settings for a multi-page report); a receipt needs none."""
    try:
        html = render_html(template_name, context)
    except ReportTemplateError:
        # Re-raise: this is a developer-facing error (bad template name or
        # missing context key), not a data problem worth log_error'ing.
        raise

    try:
        pdf_bytes = _get_pdf(html, options=wkhtmltopdf_options)
    except Exception as e:
        # Log only the template name and error type -- never the rendered
        # HTML or context, which may contain student names and amounts.
        frappe.log_error(title=f"print_reports: PDF generation failed for {template_name}", message=str(type(e).__name__))
        raise

    if not output_path:
        return pdf_bytes

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)
    return output_path
