/**
 * Client-side export helpers shared by every report page -- no server round
 * trip, operating on data the page has already fetched. Ported from the old
 * web/ Next.js frontend's lib/export.ts (edupro_school_fees repo), which had
 * a working school-letterhead PDF/xlsx/CSV/JSON/print pattern this app never
 * had; a report page only ever calls one of these instead of re-implementing
 * export/letterhead logic per report.
 */

import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
}

export function downloadJson(filename: string, data: unknown) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
}

export async function downloadXlsx(filename: string, sheetName: string, header: string[], rows: Array<Array<string | number>>) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Report')
  sheet.addRow(header)
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) sheet.addRow(row)
  sheet.columns.forEach((col) => { col.width = 22 })
  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(filename, new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Fetches a same-origin file (e.g. School Setup.school_logo) and returns it
 * as a data URL jsPDF's addImage can embed -- jsPDF can't fetch a URL itself,
 * it needs the bytes already in hand. Returns null on any failure (missing
 * logo, network hiccup) so callers can render the letterhead without one
 * rather than breaking the whole export. */
async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return null
    const blob = await res.blob()
    const format = blob.type === 'image/jpeg' ? 'JPEG' : 'PNG'
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return { dataUrl, format }
  } catch {
    return null
  }
}

export interface PdfSection {
  heading?: string
  columns: string[]
  rows: Array<Array<string | number>>
}

export interface PdfLetterhead {
  schoolName: string
  registrationNumber?: string
  emisNumber?: string
  logoUrl?: string
  address?: string
  telephone?: string
  email?: string
  /** School Setup's own custom text for this document type (e.g.
   * receipt_header/receipt_footer, statement_header/statement_footer) --
   * distinct per document type, so callers pass the field that matches
   * what they're generating rather than this type hardcoding one. */
  headerNote?: string
  footerNote?: string
}

function contactLine(letterhead: PdfLetterhead): string {
  return [letterhead.address, [letterhead.telephone, letterhead.email].filter(Boolean).join(' · ')]
    .filter(Boolean)
    .join('   ')
}

/** Builds and downloads a PDF with a consistent school letterhead and "Page X
 * of Y" footer on every page -- generated client-side (jsPDF), so it works
 * identically regardless of which report calls it. `qrUrl`, when given
 * (Statement/Profile exports), renders a small verification QR top-right --
 * plain reports don't pass one, since there's no per-document identity to
 * verify the way a Statement/Profile/Receipt has. */
export interface PdfSummary {
  label: string
  value: string
}

async function buildReportPdf(title: string, letterhead: PdfLetterhead, meta: string, sections: PdfSection[], qrUrl?: string, summary?: PdfSummary): Promise<jsPDF> {
  const doc = new jsPDF()
  const [logo, qrDataUrl] = await Promise.all([
    letterhead.logoUrl ? loadImageAsDataUrl(letterhead.logoUrl) : Promise.resolve(null),
    qrUrl ? QRCode.toDataURL(qrUrl, { margin: 1, width: 120 }) : Promise.resolve(null),
  ])
  const textX = logo ? 30 : 14
  let cursorY = 15

  if (logo) doc.addImage(logo.dataUrl, logo.format, 14, 10, 14, 14)
  if (qrDataUrl) {
    const qrSize = 18
    doc.addImage(qrDataUrl, 'PNG', doc.internal.pageSize.getWidth() - 14 - qrSize, 8, qrSize, qrSize)
    doc.setFontSize(6)
    doc.setTextColor(140)
    doc.text('Scan to verify', doc.internal.pageSize.getWidth() - 14 - qrSize / 2, 8 + qrSize + 3, { align: 'center' })
    doc.setTextColor(0)
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(letterhead.schoolName, textX, cursorY)
  cursorY += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const idLine = [
    letterhead.registrationNumber && `Reg. No: ${letterhead.registrationNumber}`,
    letterhead.emisNumber && `EMIS: ${letterhead.emisNumber}`,
  ].filter(Boolean).join('   ')
  if (idLine) {
    doc.text(idLine, textX, cursorY)
    cursorY += 5
  }
  const contact = contactLine(letterhead)
  if (contact) {
    doc.text(contact, textX, cursorY)
    cursorY += 5
  }
  cursorY = Math.max(cursorY, 26)
  if (letterhead.headerNote) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(90)
    doc.text(letterhead.headerNote, 14, cursorY, { maxWidth: doc.internal.pageSize.getWidth() - 28 })
    doc.setTextColor(0)
    cursorY += 6
  }
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, cursorY)
  cursorY += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(meta, 14, cursorY)
  cursorY += 4

  if (summary) {
    cursorY += 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90)
    doc.text(summary.label, 14, cursorY)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    cursorY += 9
    doc.text(summary.value, 14, cursorY)
    cursorY += 4
  }

  for (const section of sections) {
    if (section.heading) {
      cursorY += 4
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(section.heading, 14, cursorY)
      doc.setFont('helvetica', 'normal')
    }
    autoTable(doc, {
      startY: cursorY + 3,
      head: [section.columns],
      body: section.rows.map((row) => row.map(String)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 40, 40] },
      margin: { top: 20 },
    })
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  if (letterhead.footerNote) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(90)
    doc.text(letterhead.footerNote, 14, cursorY, { maxWidth: doc.internal.pageSize.getWidth() - 28 })
    doc.setTextColor(0)
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
    doc.text(new Date().toISOString().slice(0, 10), 14, doc.internal.pageSize.getHeight() - 8)
  }

  return doc
}

export async function exportReportPdf(filename: string, title: string, letterhead: PdfLetterhead, meta: string, sections: PdfSection[], qrUrl?: string, summary?: PdfSummary) {
  const doc = await buildReportPdf(title, letterhead, meta, sections, qrUrl, summary)
  doc.save(filename)
}

/** Opens the same PDF exportReportPdf() would download, in a new browser
 * tab instead -- the "View" action every document/report page uses in
 * place of a system print dialog (see openReceiptPdf's own comment for why
 * a real PDF tab replaced print() everywhere in this app). */
export async function openReportPdf(title: string, letterhead: PdfLetterhead, meta: string, sections: PdfSection[], qrUrl?: string, summary?: PdfSummary) {
  const doc = await buildReportPdf(title, letterhead, meta, sections, qrUrl, summary)
  window.open(doc.output('bloburl'), '_blank')
}

export interface ReceiptPdfData {
  receiptNumber: string
  integrityHash?: string
  postingDate: string
  studentName: string
  studentId: string
  studentClass?: string
  amount: number
  currency: 'ZiG' | 'USD'
  paymentMethod: string
  externalReference?: string
  narration?: string
  receivedBy?: string
}

// buildReceiptPdf/downloadReceiptPdf/openReceiptPdf (the client-side jsPDF
// receipt slip) were removed once ReceiptActions switched to
// print_reports.generate_receipt_pdf -- the server-rendered design is now
// the only one anything in the app produces.

