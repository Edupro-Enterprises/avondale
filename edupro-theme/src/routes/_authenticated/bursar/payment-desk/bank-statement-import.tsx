import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { CheckCircle2, FileUp, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { formatStudentName } from '@/lib/utils'
import { usePaymentMethods } from '@/lib/frappe/receipts'
import { useStudents } from '@/lib/frappe/students'
import { useStudentInvoices } from '@/lib/frappe/invoices'
import {
  useBankStatementImports,
  useBankStatementImport,
  useCreateBankStatementImport,
  useParseStatement,
  useSetManualMatch,
  useConfirmStatementLine,
  type FrappeBankStatementImport,
  type FrappeBankStatementLine,
} from '@/lib/frappe/bank-statement-imports'

export const Route = createFileRoute('/_authenticated/bursar/payment-desk/bank-statement-import')({
  component: BankStatementImportPage,
})

const importStatusTone: Record<FrappeBankStatementImport['status'], StatusTone> = {
  Draft: 'neutral',
  Parsed: 'warning',
  Completed: 'good',
}

const matchStatusTone: Record<FrappeBankStatementLine['match_status'], StatusTone> = {
  Unmatched: 'neutral',
  'Manual Review': 'warning',
  Matched: 'info',
  Posted: 'good',
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function BankStatementImportPage() {
  const { data: imports, isLoading, error } = useBankStatementImports()
  const { data: paymentMethods } = usePaymentMethods()
  const { data: students } = useStudents()
  const rows = useMemo(() => imports ?? [], [imports])

  const [selectedName, setSelectedName] = useState<string | null>(null)
  const { data: selected } = useBankStatementImport(selectedName ?? undefined)

  const [newOpen, setNewOpen] = useState(false)
  const [newAccount, setNewAccount] = useState('')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [newDate, setNewDate] = useState(todayIso)

  const [matching, setMatching] = useState<FrappeBankStatementLine | null>(null)
  const [matchStudentQuery, setMatchStudentQuery] = useState('')
  const [matchStudent, setMatchStudent] = useState('')

  const createImport = useCreateBankStatementImport()
  const parseStatement = useParseStatement()
  const setManualMatch = useSetManualMatch()
  const confirmLine = useConfirmStatementLine()

  const { data: matchInvoices } = useStudentInvoices(matchStudent)
  const matchedStudent = useMemo(() => (students ?? []).find((s) => s.name === matchStudent), [students, matchStudent])
  const matchStudentMatches = useMemo(() => {
    const q = matchStudentQuery.trim().toLowerCase()
    if (!q) return []
    return (students ?? [])
      .filter((s) => formatStudentName(s.first_name, s.last_name).toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 10)
  }, [students, matchStudentQuery])

  const accountName = (account: string) => paymentMethods?.find((pm) => pm.name === account)?.method_name ?? account

  function resetNewForm() {
    setNewAccount('')
    setNewFile(null)
    setNewDate(todayIso())
  }

  function resetMatchForm() {
    setMatching(null)
    setMatchStudentQuery('')
    setMatchStudent('')
  }

  async function handleCreate() {
    if (!newAccount || !newFile) {
      toast.error('Pick an account and attach a statement file.')
      return
    }
    try {
      const name = await createImport.mutateAsync({ bankAccount: newAccount, file: newFile, importDate: newDate })
      toast.success(`${name} created`)
      setNewOpen(false)
      resetNewForm()
      setSelectedName(name)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this import.')
    }
  }

  async function handleParse() {
    if (!selected) return
    try {
      const result = await parseStatement.mutateAsync(selected.name)
      toast.success(`${result.lines_added} line(s) parsed`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not parse this statement.')
    }
  }

  async function handleSetMatch(invoice: string) {
    if (!selected || !matching) return
    try {
      await setManualMatch.mutateAsync({ bankStatementImport: selected.name, rowName: matching.name, invoice })
      toast.success('Match set')
      resetMatchForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not set this match.')
    }
  }

  async function handleConfirm(line: FrappeBankStatementLine) {
    if (!selected) return
    try {
      const receipt = await confirmLine.mutateAsync({ bankStatementImport: selected.name, rowName: line.name })
      toast.success(`${receipt} posted`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not post this line.')
    }
  }

  const columns: DataListColumn<FrappeBankStatementImport>[] = [
    { id: 'id', header: 'Import', sortable: true, sortValue: (i) => i.name, cell: (i) => i.name },
    { id: 'account', header: 'Account', sortable: true, sortValue: (i) => accountName(i.bank_account), cell: (i) => accountName(i.bank_account) },
    { id: 'date', header: 'Import Date', sortable: true, sortValue: (i) => i.import_date, cell: (i) => i.import_date },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (i) => i.status,
      cell: (i) => <StatusBadge tone={importStatusTone[i.status]}>{i.status}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Payments</p>
            <h1 className='text-3xl font-bold tracking-tight'>Bank Statement Import</h1>
            <p className='text-sm text-muted-foreground'>Import a bank/EcoCash statement, match each line to an invoice, then confirm to post a real Receipt. Nothing posts automatically.</p>
          </div>
          <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) resetNewForm() }}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />New import</Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-sm'>
              <DialogHeader>
                <DialogTitle>Import a statement</DialogTitle>
                <DialogDescription>CSV with date, description, reference, amount columns.</DialogDescription>
              </DialogHeader>
              <div className='grid gap-3 py-2'>
                <div className='grid gap-2'>
                  <Label>Account</Label>
                  <Select value={newAccount} onValueChange={setNewAccount}>
                    <SelectTrigger><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>
                      {(paymentMethods ?? []).map((pm) => <SelectItem key={pm.name} value={pm.name}>{pm.method_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='import-date'>Import date</Label>
                  <Input id='import-date' type='date' value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='statement-file'>Statement file (CSV)</Label>
                  <Input id='statement-file' type='file' accept='.csv' onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createImport.isPending}>{createImport.isPending ? 'Creating…' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load imports from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card className='mb-6'>
          <CardHeader className='border-b'>
            <CardTitle>All imports</CardTitle>
            <CardDescription>{rows.length} total</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={rows}
              columns={columns}
              getRowId={(i) => i.name}
              isLoading={isLoading}
              onRowClick={(i) => setSelectedName(i.name)}
              densityStorageKey='bank-statement-imports'
              emptyState={{ icon: FileUp, title: 'No imports yet', description: 'Import a bank statement to get started.' }}
            />
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader className='flex flex-row items-center justify-between border-b'>
              <div>
                <CardTitle>{selected.name} · {accountName(selected.bank_account)}</CardTitle>
                <CardDescription>{selected.import_date} · <StatusBadge tone={importStatusTone[selected.status]}>{selected.status}</StatusBadge></CardDescription>
              </div>
              {selected.status === 'Draft' && (
                <Button onClick={handleParse} disabled={parseStatement.isPending}>{parseStatement.isPending ? 'Parsing…' : 'Parse statement'}</Button>
              )}
            </CardHeader>
            <CardContent className='divide-y pt-0'>
              {selected.lines.length === 0 && (
                <p className='py-6 text-center text-sm text-muted-foreground'>
                  {selected.status === 'Draft' ? 'Parse the statement to see its lines.' : 'No lines on this import.'}
                </p>
              )}
              {selected.lines.map((line) => (
                <div key={line.name} className='flex flex-wrap items-center justify-between gap-3 py-3'>
                  <div>
                    <p className='text-sm font-medium'>{line.description || '—'}</p>
                    <p className='text-xs text-muted-foreground'>{line.transaction_date} · {line.reference || 'no reference'}</p>
                    {line.matched_student && <p className='text-xs text-muted-foreground'>Matched: {line.matched_student} · {line.matched_invoice}</p>}
                  </div>
                  <div className='flex items-center gap-3'>
                    <Money usd={line.amount} compact />
                    <StatusBadge tone={matchStatusTone[line.match_status]}>{line.match_status}</StatusBadge>
                    {(line.match_status === 'Unmatched' || line.match_status === 'Manual Review') && (
                      <Button size='sm' variant='outline' onClick={() => setMatching(line)}>Set match</Button>
                    )}
                    {line.match_status === 'Matched' && (
                      <Button size='sm' onClick={() => handleConfirm(line)} disabled={confirmLine.isPending}>
                        <CheckCircle2 className='h-4 w-4' />
                        {confirmLine.isPending ? 'Posting…' : 'Confirm & post'}
                      </Button>
                    )}
                    {line.match_status === 'Posted' && line.receipt && (
                      <span className='text-xs text-emerald-600'>{line.receipt}</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!matching} onOpenChange={(o) => !o && resetMatchForm()}>
          <DialogContent className='sm:max-w-sm'>
            <DialogHeader>
              <DialogTitle>Match this line</DialogTitle>
              <DialogDescription>{matching?.description} · <Money usd={matching?.amount ?? 0} compact /></DialogDescription>
            </DialogHeader>
            <div className='grid gap-3 py-2'>
              {!matchStudent ? (
                <div className='relative'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    className='pl-8'
                    placeholder='Search by student name…'
                    value={matchStudentQuery}
                    onChange={(e) => setMatchStudentQuery(e.target.value)}
                  />
                </div>
              ) : (
                <div className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
                  <span>{matchedStudent ? formatStudentName(matchedStudent.first_name, matchedStudent.last_name) : ''}</span>
                  <Button variant='ghost' size='sm' className='h-6 px-2 text-xs' onClick={() => setMatchStudent('')}>Change</Button>
                </div>
              )}
              {!matchStudent && matchStudentQuery && (
                <div className='max-h-48 divide-y overflow-y-auto rounded-md border'>
                  {matchStudentMatches.length === 0 && <p className='px-3 py-2 text-sm text-muted-foreground'>No students match.</p>}
                  {matchStudentMatches.map((s) => (
                    <button
                      key={s.name}
                      type='button'
                      className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50'
                      onClick={() => { setMatchStudent(s.name); setMatchStudentQuery('') }}
                    >
                      <span>{formatStudentName(s.first_name, s.last_name)}</span>
                      <span className='text-xs text-muted-foreground'>{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {matchStudent && (
                <div className='max-h-48 divide-y overflow-y-auto rounded-md border'>
                  {(matchInvoices ?? []).filter((inv) => inv.outstanding_amount > 0).length === 0 && (
                    <p className='px-3 py-2 text-sm text-muted-foreground'>No outstanding invoices for this student.</p>
                  )}
                  {(matchInvoices ?? []).filter((inv) => inv.outstanding_amount > 0).map((inv) => (
                    <button
                      key={inv.name}
                      type='button'
                      className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50'
                      onClick={() => handleSetMatch(inv.name)}
                    >
                      <span>{inv.name}</span>
                      <Money usd={inv.outstanding_amount} compact />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
