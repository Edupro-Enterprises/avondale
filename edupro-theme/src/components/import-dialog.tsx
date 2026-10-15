import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { downloadImportTemplate, parseXlsxRows } from '@/lib/bulk-import'

export interface ImportRowResult {
  row: number
  label: string
  ok: boolean
  error?: string
}

interface ImportDialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  templateFilename: string
  templateHeaders: string[]
  templateSample: Array<string | number>
  /** Turns one parsed spreadsheet row into either a valid record or an
   * error string (e.g. a missing required column) -- validated entirely
   * client-side before anything is submitted. A tagged union rather than a
   * bare `T | { error }` union: TypeScript can't safely narrow the latter
   * via `'error' in outcome` when T is an unconstrained generic that could
   * itself have an `error` property. */
  parseRow: (row: Record<string, string>, index: number) => { error: string } | { error?: undefined; value: T }
  rowLabel: (record: T) => string
  /** Submits one row through the app's normal create/update hook -- each
   * row commits independently (same principle as the backend's own
   * run_batch_invoicing), so one bad row doesn't block the rest. */
  commitRow: (record: T) => Promise<void>
  onImported?: () => void
}

/** Generic "download a template, upload it back, import" flow shared by
 * Students, Guardians, and Class enrollment -- each page only supplies its
 * own columns and how to submit one row; the file handling, preview, and
 * per-row progress/results are identical everywhere. */
export function ImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  templateFilename,
  templateHeaders,
  templateSample,
  parseRow,
  rowLabel,
  commitRow,
  onImported,
}: ImportDialogProps<T>) {
  const [parsed, setParsed] = useState<Array<{ record: T; label: string } | { error: string; index: number }> | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportRowResult[] | null>(null)

  function reset() {
    setParsed(null)
    setResults(null)
    setImporting(false)
  }

  async function handleFile(file: File) {
    setResults(null)
    try {
      const rows = await parseXlsxRows(file)
      const next = rows.map((row, i) => {
        const outcome = parseRow(row, i)
        if (!('value' in outcome)) return { error: outcome.error, index: i }
        return { record: outcome.value, label: rowLabel(outcome.value) }
      })
      setParsed(next)
    } catch {
      toast.error('Could not read that file -- make sure it\'s a .xlsx file matching the template.')
    }
  }

  async function handleImport() {
    if (!parsed) return
    const valid = parsed.filter((p): p is { record: T; label: string } => !('error' in p))
    if (valid.length === 0) {
      toast.error('No valid rows to import.')
      return
    }
    setImporting(true)
    const outcomes: ImportRowResult[] = []
    for (let i = 0; i < valid.length; i++) {
      const { record, label } = valid[i]
      try {
        await commitRow(record)
        outcomes.push({ row: i + 1, label, ok: true })
      } catch (err) {
        outcomes.push({ row: i + 1, label, ok: false, error: err instanceof Error ? err.message : 'Failed' })
      }
      setResults([...outcomes])
    }
    setImporting(false)
    const succeeded = outcomes.filter((o) => o.ok).length
    toast.success(`Imported ${succeeded} of ${outcomes.length} rows`)
    onImported?.()
  }

  const errorRows = parsed?.filter((p): p is { error: string; index: number } => 'error' in p) ?? []
  const validRows = parsed?.filter((p): p is { record: T; label: string } => !('error' in p)) ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'><FileSpreadsheet className='h-4 w-4 text-primary' />{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className='grid gap-4'>
          <Button
            variant='outline'
            onClick={() => downloadImportTemplate(templateFilename, title, templateHeaders, templateSample)}
          >
            <Download className='h-4 w-4' />
            Download template
          </Button>

          <div className='grid gap-2'>
            <label className='flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/50'>
              <Upload className='h-4 w-4' />
              Click to choose a filled-in .xlsx file
              <input
                type='file'
                accept='.xlsx'
                className='hidden'
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </label>
          </div>

          {parsed && !results && (
            <Card>
              <CardContent className='space-y-1 py-3 text-sm'>
                <p><span className='font-medium text-emerald-600'>{validRows.length}</span> rows ready to import</p>
                {errorRows.length > 0 && (
                  <p className='text-destructive'>{errorRows.length} rows skipped: {errorRows.slice(0, 3).map((e) => `row ${e.index + 2} (${e.error})`).join(', ')}{errorRows.length > 3 ? '…' : ''}</p>
                )}
              </CardContent>
            </Card>
          )}

          {results && (
            <div className='max-h-56 divide-y overflow-y-auto rounded-md border'>
              {results.map((r) => (
                <div key={r.row} className='flex items-center justify-between px-3 py-2 text-sm'>
                  <span className='flex items-center gap-2'>
                    {r.ok ? <CheckCircle2 className='h-3.5 w-3.5 text-emerald-600' /> : <XCircle className='h-3.5 w-3.5 text-destructive' />}
                    {r.label}
                  </span>
                  {!r.ok && <span className='text-xs text-destructive'>{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleImport} disabled={!parsed || validRows.length === 0 || importing}>
            {importing ? `Importing… (${results?.length ?? 0}/${validRows.length})` : `Import ${validRows.length || ''} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
