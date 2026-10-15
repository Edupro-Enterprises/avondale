import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSchoolSetup, useDocumentLetterhead } from '@/lib/frappe/school-setup'
import { exportReportPdf, openReportPdf, type PdfSection, type PdfSummary } from '@/lib/export'
import { viewServerPdf, downloadServerPdf } from '@/lib/print-reports'
import { verificationUrlForStudent } from '@/lib/student-documents'

const GENERATE_STUDENT_STATEMENT_PDF = 'edupro_school_fees.print_reports.api.generate_student_statement_pdf'

interface StudentDocumentActionsProps {
  kind: 'profile' | 'statement'
  studentId: string
  studentName: string
  sections: PdfSection[]
  /** A big standout figure (e.g. total balance) rendered above the table --
   * statements pass this, profiles don't. */
  summary?: PdfSummary
  size?: 'default' | 'sm'
}

/** Print / Download PDF for a Student Profile or Statement -- used from both
 * Payment Desk's Student Lookup and the Student detail page. Each document
 * carries a verification QR (see verify-document.tsx), and School Setup's
 * statement_header/footer note applies only to statements, not profiles. */
export function StudentDocumentActions({ kind, studentId, studentName, sections, summary, size = 'default' }: StudentDocumentActionsProps) {
  const base = useDocumentLetterhead()
  const { data: schoolSetup } = useSchoolSetup()
  const [viewing, setViewing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const letterhead = {
    ...base,
    headerNote: kind === 'statement' ? schoolSetup?.statement_header : undefined,
    footerNote: kind === 'statement' ? schoolSetup?.statement_footer : undefined,
  }
  const title = kind === 'statement' ? `Statement -- ${studentName}` : `Student Profile -- ${studentName}`
  const meta = `${studentId} · Generated ${new Date().toISOString().slice(0, 10)}`
  const qrUrl = verificationUrlForStudent(studentId)

  // Statement has a real print_reports design (generate_student_statement_pdf)
  // -- renders server-side instead of the old client-side jsPDF build.
  // Profile has no server-side equivalent yet, so it stays on the old
  // pipeline unchanged.
  async function handleView() {
    setViewing(true)
    try {
      if (kind === 'statement') await viewServerPdf(GENERATE_STUDENT_STATEMENT_PDF, { student: studentId })
      else await openReportPdf(title, letterhead, meta, sections, qrUrl, summary)
    } catch {
      toast.error('Could not open the document -- try Download PDF instead.')
    } finally {
      setViewing(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      if (kind === 'statement') await downloadServerPdf(GENERATE_STUDENT_STATEMENT_PDF, { student: studentId }, `statement-${studentId}.pdf`)
      else await exportReportPdf(`${kind}-${studentId}.pdf`, title, letterhead, meta, sections, qrUrl, summary)
    } catch {
      toast.error('Could not generate the PDF.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Button size={size} variant='outline' onClick={handleView} disabled={viewing}>
        <Eye className='h-4 w-4' />
        {viewing ? 'Preparing…' : 'View'}
      </Button>
      <Button size={size} variant='outline' onClick={handleDownload} disabled={downloading}>
        <Download className='h-4 w-4' />
        {downloading ? 'Preparing…' : 'Download PDF'}
      </Button>
    </div>
  )
}
