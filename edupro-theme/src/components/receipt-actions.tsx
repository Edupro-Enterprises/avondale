import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { viewServerPdf, downloadServerPdf } from '@/lib/print-reports'
import type { ReceiptPdfData } from '@/lib/export'

const GENERATE_RECEIPT_PDF = 'edupro_school_fees.print_reports.api.generate_receipt_pdf'

/** View / Download PDF for a single receipt -- used both right after
 * posting a new receipt and to reprint any past one from Receipt History.
 * Renders server-side (print_reports' official-receipt design, the one
 * every printed/reprinted receipt is meant to look like) instead of the
 * old client-side jsPDF build -- the server already has the letterhead,
 * QR, and verification token, so this needs only the receipt's name. */
export function ReceiptActions({ receipt, size = 'default' }: { receipt: ReceiptPdfData; size?: 'default' | 'sm' }) {
  const [viewing, setViewing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleView() {
    setViewing(true)
    try {
      await viewServerPdf(GENERATE_RECEIPT_PDF, { receipt: receipt.receiptNumber })
    } catch {
      toast.error('Could not open the receipt -- try Download PDF instead.')
    } finally {
      setViewing(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadServerPdf(GENERATE_RECEIPT_PDF, { receipt: receipt.receiptNumber }, `${receipt.receiptNumber}.pdf`)
    } catch {
      toast.error('Could not generate the receipt PDF.')
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
