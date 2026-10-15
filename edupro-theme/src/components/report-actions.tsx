import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDocumentLetterhead } from '@/lib/frappe/school-setup'
import { downloadCsv, downloadJson, downloadXlsx, exportReportPdf, openReportPdf } from '@/lib/export'
import { viewFinancialReportPdf, downloadFinancialReportPdf } from '@/lib/print-reports'
import { FrappeApiError } from '@/lib/frappe/client'

/** filename is used (minus extension) as the base for every format, header as
 * the first CSV/xlsx row and the PDF table's column headers, rows as the
 * same rows for every format -- one row shape powers CSV/xlsx/JSON/PDF so a
 * report page only ever has to build its data once. title/meta feed the
 * PDF's letterhead (school name + report title + date range). Ported from
 * the old web/ frontend's ReportActions (edupro_school_fees repo's
 * components/staff/report-actions.tsx), swapping its SWR fetch for this
 * app's own useSchoolSetup.
 *
 * PDF/View: when reportKey is given, both hit the real print_reports
 * server-side design (the one this app's reports are meant to render as)
 * instead of building a PDF client-side with jsPDF -- CSV/Excel/JSON stay
 * client-side either way, that's not part of "which PDF design renders."
 * Omit reportKey for a report with no print_reports equivalent yet; it
 * falls back to the old client-side PDF unchanged. */
export function ReportActions({
  filename,
  title,
  meta,
  header,
  rows,
  reportKey,
  reportParams,
}: {
  filename: string
  title: string
  meta: string
  header: string[]
  rows: Array<Array<string | number>>
  reportKey?: string
  reportParams?: Record<string, string | number | undefined>
}) {
  const letterhead = useDocumentLetterhead()

  async function handleDownloadPdf() {
    try {
      if (reportKey) await downloadFinancialReportPdf(reportKey, reportParams, `${filename}.pdf`)
      else await exportReportPdf(`${filename}.pdf`, title, letterhead, meta, [{ columns: header, rows }])
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not generate the PDF.')
    }
  }

  async function handleViewPdf() {
    try {
      if (reportKey) await viewFinancialReportPdf(reportKey, reportParams)
      else await openReportPdf(title, letterhead, meta, [{ columns: header, rows }])
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not open the PDF.')
    }
  }

  return (
    <div className='flex flex-wrap gap-2 print:hidden'>
      <Button size='sm' variant='outline' onClick={() => downloadCsv(`${filename}.csv`, [header, ...rows])}>
        CSV
      </Button>
      <Button size='sm' variant='outline' onClick={() => downloadXlsx(`${filename}.xlsx`, title, header, rows)}>
        Excel
      </Button>
      <Button size='sm' variant='outline' onClick={() => downloadJson(`${filename}.json`, rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]]))))}>
        JSON
      </Button>
      <Button size='sm' variant='outline' onClick={handleDownloadPdf}>
        PDF
      </Button>
      <Button size='sm' variant='outline' onClick={handleViewPdf}>
        <Eye className='h-4 w-4' />
        View
      </Button>
    </div>
  )
}
