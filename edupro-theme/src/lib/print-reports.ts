/**
 * Server-side PDF generation -- edupro_school_fees/print_reports/api.py's
 * one consistent Sage/QuickBooks-style design, as opposed to export.ts's
 * client-side jsPDF (the older, ad-hoc-per-page pipeline this is meant to
 * replace wherever a print_reports report_key/endpoint actually covers a
 * page). Every endpoint here returns the real PDF bytes directly (Frappe's
 * `frappe.local.response.type`), not JSON -- as_attachment picks between
 * Content-Disposition: attachment (a real download) and inline (opens in
 * the browser's own PDF viewer, for "View"), so one endpoint serves both
 * buttons instead of needing two.
 *
 * Fetches the PDF itself (rather than a bare `window.open(url)`) so a
 * server-side failure (permission denied, bad params, a report_service
 * exception) surfaces as a real FrappeApiError the caller can show a toast
 * for, instead of silently opening a blank tab or Frappe's own raw error
 * page -- the same failure mode api.ts's request() already guards against
 * for every other endpoint in this app.
 */
import { FrappeApiError } from './frappe/client'

function buildUrl(method: string, params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value))
  }
  return `/api/method/${method}?${qs.toString()}`
}

async function fetchPdf(method: string, params: Record<string, string | number | boolean | undefined>): Promise<Blob> {
  const res = await fetch(buildUrl(method, params), { credentials: 'include' })
  if (!res.ok) {
    let serverMessages: string[] | undefined
    try {
      const body = await res.json()
      serverMessages = body._server_messages ? JSON.parse(body._server_messages) : undefined
    } catch {
      // response wasn't JSON (e.g. wkhtmltopdf itself failed) -- no server messages to surface
    }
    throw new FrappeApiError(`Frappe API error: ${res.status}`, res.status, serverMessages)
  }
  return res.blob()
}

/** Opens the PDF inline in a new tab -- the "View" action. */
export async function viewServerPdf(method: string, params: Record<string, string | number | boolean | undefined> = {}) {
  const blob = await fetchPdf(method, { ...params, as_attachment: false })
  window.open(URL.createObjectURL(blob), '_blank')
}

/** Triggers a real browser download -- the "Download PDF" action. */
export async function downloadServerPdf(method: string, params: Record<string, string | number | boolean | undefined> = {}, filename?: string) {
  const blob = await fetchPdf(method, { ...params, as_attachment: true })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  if (filename) a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const FINANCIAL_REPORT_METHOD = 'edupro_school_fees.print_reports.api.generate_financial_report_pdf'

/** report_key must be one of print_reports/api.py's _REPORT_BUILDERS keys
 * (daily-cash-collection, payment-summary, outstanding-fees,
 * income-expenditure, financial-position, cashbook, receipts-and-payments,
 * trial-balance, fixed-assets-register, termly-fee-collection,
 * bank-reconciliation, budget-variance, beam-reconciliation) -- an unknown
 * key throws server-side, not silently produces a blank report. */
export function viewFinancialReportPdf(reportKey: string, params: Record<string, string | number | undefined> = {}) {
  return viewServerPdf(FINANCIAL_REPORT_METHOD, { report_key: reportKey, ...params })
}

export function downloadFinancialReportPdf(reportKey: string, params: Record<string, string | number | undefined> = {}, filename?: string) {
  return downloadServerPdf(FINANCIAL_REPORT_METHOD, { report_key: reportKey, ...params }, filename ?? `${reportKey}.pdf`)
}
