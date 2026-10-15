import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ClipboardPlus, FileSearch, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError, uploadFile } from '@/lib/frappe/client'
import { useBudgetLines, useBudgetVoteBooks, type FrappeBudgetVoteBook } from '@/lib/frappe/budget-lines'
import { useAccounts } from '@/lib/frappe/accounts'
import { useVendors } from '@/lib/frappe/vendors'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { zigToUsd } from '@/lib/currency'
import { useIssuePurchaseOrder } from '@/lib/frappe/purchase-orders'
import type { Fund } from '@/lib/frappe/journal-entries'
import {
  useRequisitions,
  useRequisition,
  useCreateRequisition,
  useSaveRequisitionQuotations,
  getRequiredQuoteCount,
  type FrappeRequisition,
  type NewRequisitionItemInput,
  type QuotationItemInput,
} from '@/lib/frappe/requisitions'

export const Route = createFileRoute('/_authenticated/bursar/procurement/requisitions')({
  component: RequisitionsPage,
})

const todayIso = () => new Date().toISOString().slice(0, 10)
const FUNDS: Fund[] = ['Fund A - General/Government', 'Fund B - SDC/SDA']

const statusTone: Record<FrappeRequisition['status'], StatusTone> = { Open: 'neutral', Closed: 'good' }

const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'status', label: 'Status', options: ['Open', 'Closed'] }]

function RequisitionsPage() {
  const { data: requisitions, isLoading, error } = useRequisitions()
  const { data: budgetLines } = useBudgetLines()
  const { data: voteBooks } = useBudgetVoteBooks()
  const { data: accounts } = useAccounts()
  const { data: vendors } = useVendors()
  const filters = useFilters('requisitions', FILTER_GROUPS)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()

  /** Requisition/Requisition Item have no currency field of their own --
   * they inherit their budget line's expense_account currency, same
   * reasoning as Budget Vote Book's own amount formatting -- converted to
   * USD for display, matching every other list/dashboard/report. */
  const accountCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const a of accounts ?? []) map.set(a.name, a.currency)
    return map
  }, [accounts])
  const budgetLineCurrency = useMemo(() => {
    const map = new Map<string, 'ZiG' | 'USD'>()
    for (const b of budgetLines ?? []) map.set(b.name, accountCurrency.get(b.expense_account) ?? 'ZiG')
    return map
  }, [budgetLines, accountCurrency])
  function formatAmount(amount: number, budgetLine: string) {
    const usd = budgetLineCurrency.get(budgetLine) === 'USD' ? amount : zigToUsd(amount, zigPerUsd)
    return <Money usd={usd} />
  }
  function quoteAmountUsd(q: { currency: string; quoted_amount: number }) {
    return q.currency === 'ZiG' ? zigToUsd(q.quoted_amount, zigPerUsd) : q.quoted_amount
  }

  const [newOpen, setNewOpen] = useState(false)
  const [fund, setFund] = useState<Fund>(FUNDS[0])
  const [budgetLine, setBudgetLine] = useState('')
  const [purpose, setPurpose] = useState('')
  const [postingDate, setPostingDate] = useState(todayIso)
  const [items, setItems] = useState<NewRequisitionItemInput[]>([{ description: '', quantity: 1, estimated_unit_cost: 0 }])

  const [selectedName, setSelectedName] = useState<string | null>(null)
  const { data: selected } = useRequisition(selectedName ?? undefined)
  const { data: requiredQuotes } = useQuery({
    queryKey: ['required-quote-count', selected?.total_estimated_amount],
    queryFn: () => getRequiredQuoteCount(selected!.total_estimated_amount),
    enabled: !!selected,
  })

  const createRequisition = useCreateRequisition()
  const saveQuotations = useSaveRequisitionQuotations()
  const issuePO = useIssuePurchaseOrder()

  const [quoteVendor, setQuoteVendor] = useState('')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteCurrency, setQuoteCurrency] = useState<'ZiG' | 'USD'>('ZiG')
  const [quoteSelected, setQuoteSelected] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [quoteFileUrl, setQuoteFileUrl] = useState<string | undefined>(undefined)
  const [uploadingQuote, setUploadingQuote] = useState(false)

  const budgetLinesForFund = useMemo(() => (budgetLines ?? []).filter((b) => b.fund === fund), [budgetLines, fund])
  const voteBookStatus = useMemo(() => {
    const map = new Map<string, FrappeBudgetVoteBook['workflow_state']>()
    for (const v of voteBooks ?? []) map.set(v.name, v.workflow_state)
    return map
  }, [voteBooks])
  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.estimated_unit_cost, 0)

  function resetNewForm() {
    setFund(FUNDS[0])
    setBudgetLine('')
    setPurpose('')
    setPostingDate(todayIso())
    setItems([{ description: '', quantity: 1, estimated_unit_cost: 0 }])
  }

  function updateItem(i: number, patch: Partial<NewRequisitionItemInput>) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)))
  }

  async function submitRequisition() {
    const cleanItems = items.filter((i) => i.description.trim() && i.quantity > 0 && i.estimated_unit_cost > 0)
    if (!budgetLine || !purpose.trim() || cleanItems.length === 0) {
      toast.error('Budget line, purpose and at least one complete item line are required.')
      return
    }
    try {
      const name = await createRequisition.mutateAsync({ fund, budget_line: budgetLine, purpose: purpose.trim(), posting_date: postingDate, items: cleanItems })
      toast.success(`${name} created`)
      setNewOpen(false)
      resetNewForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create this requisition.')
    }
  }

  function resetQuoteForm() {
    setQuoteVendor('')
    setQuoteAmount('')
    setQuoteCurrency('ZiG')
    setQuoteSelected(false)
    setQuoteFileUrl(undefined)
  }

  async function handleQuoteFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingQuote(true)
    try {
      setQuoteFileUrl(await uploadFile(file, { isPrivate: true }))
      toast.success('Quotation document attached')
    } catch {
      toast.error('Could not upload this document.')
    } finally {
      setUploadingQuote(false)
    }
  }

  async function addQuotation() {
    if (!selected) return
    const amount = Number(quoteAmount)
    if (!quoteVendor || !amount || amount <= 0 || !quoteFileUrl) {
      toast.error('Vendor, a positive amount and the quotation document are all required.')
      return
    }
    const existing: QuotationItemInput[] = selected.quotations.map((q) => ({
      vendor: q.vendor,
      quoted_amount: q.quoted_amount,
      currency: q.currency,
      quotation_document: q.quotation_document,
      is_selected: quoteSelected ? 0 : q.is_selected,
    }))
    const next: QuotationItemInput[] = [
      ...existing,
      { vendor: quoteVendor, quoted_amount: amount, currency: quoteCurrency, quotation_document: quoteFileUrl, is_selected: quoteSelected ? 1 : 0 },
    ]
    try {
      await saveQuotations.mutateAsync({ name: selected.name, quotations: next })
      toast.success('Quotation added')
      resetQuoteForm()
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not save this quotation.')
    }
  }

  async function selectQuotation(vendorName: string) {
    if (!selected) return
    const next: QuotationItemInput[] = selected.quotations.map((q) => ({
      vendor: q.vendor,
      quoted_amount: q.quoted_amount,
      currency: q.currency,
      quotation_document: q.quotation_document,
      is_selected: q.vendor === vendorName ? 1 : 0,
    }))
    try {
      await saveQuotations.mutateAsync({ name: selected.name, quotations: next })
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update the selection.')
    }
  }

  async function issue() {
    if (!selected) return
    try {
      const name = await issuePO.mutateAsync({ requisition: selected.name, postingDate: todayIso() })
      toast.success(`${name} issued`)
      setSelectedName(null)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not issue this purchase order.')
    }
  }

  const rows = useMemo(() => requisitions ?? [], [requisitions])
  const filtered = useMemo(
    () => rows.filter((r) => r.purpose.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.values.status || r.status === filters.values.status)),
    [rows, filters.search, filters.values]
  )

  const columns: DataListColumn<FrappeRequisition>[] = [
    {
      id: 'purpose',
      header: 'Purpose',
      sortable: true,
      sortValue: (r) => r.purpose,
      className: 'min-w-48',
      cell: (r) => (
        <div className='flex flex-col'>
          <span className='truncate'>{r.purpose}</span>
          <span className='truncate text-xs text-muted-foreground'>{r.name} · {r.budget_line}</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Estimated',
      sortable: true,
      sortValue: (r) => r.total_estimated_amount,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (r) => formatAmount(r.total_estimated_amount, r.budget_line),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => r.status,
      cell: (r) => <StatusBadge tone={statusTone[r.status]}>{r.status}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Procurement</p>
            <h1 className='text-3xl font-bold tracking-tight'>Requisitions</h1>
            <p className='text-sm text-muted-foreground'>PRAZ requires more quotations at higher estimated amounts.</p>
          </div>
          <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (o) resetNewForm() }}>
            <DialogTrigger asChild>
              <Button><ClipboardPlus className='h-4 w-4' />New requisition</Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-lg'>
              <DialogHeader>
                <DialogTitle>New requisition</DialogTitle>
                <DialogDescription>Charged against a budget vote line.</DialogDescription>
              </DialogHeader>
              <div className='grid gap-4 py-2'>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='fund'>Fund</Label>
                    <Select value={fund} onValueChange={(v) => { setFund(v as Fund); setBudgetLine('') }}>
                      <SelectTrigger id='fund'><SelectValue /></SelectTrigger>
                      <SelectContent>{FUNDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='budget-line'>Budget line</Label>
                    <Select value={budgetLine} onValueChange={setBudgetLine}>
                      <SelectTrigger id='budget-line'><SelectValue placeholder='Select…' /></SelectTrigger>
                      <SelectContent>
                        {budgetLinesForFund.map((b) => {
                          const status = voteBookStatus.get(b.budget_vote_book)
                          return (
                            <SelectItem key={b.name} value={b.name} disabled={status !== 'Active'}>
                              {b.vote_code}{status && status !== 'Active' ? ` (${status} vote book)` : ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='purpose'>Purpose</Label>
                  <Textarea id='purpose' rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder='What is being requisitioned and why?' />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='posting-date'>Date</Label>
                  <Input id='posting-date' type='date' className='w-40' value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
                </div>

                <div className='space-y-2'>
                  <Label>Items</Label>
                  {items.map((item, i) => (
                    <div key={i} className='grid grid-cols-[1fr_5rem_6rem_auto] items-end gap-2'>
                      <Input placeholder='Description' value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
                      <Input type='number' min='0' placeholder='Qty' value={item.quantity || ''} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 0 })} />
                      <Input type='number' min='0' step='0.01' placeholder='Unit cost' value={item.estimated_unit_cost || ''} onChange={(e) => updateItem(i, { estimated_unit_cost: Number(e.target.value) || 0 })} />
                      <Button type='button' variant='ghost' size='icon' onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                  <div className='flex items-center justify-between'>
                    <Button type='button' variant='outline' size='sm' onClick={() => setItems((prev) => [...prev, { description: '', quantity: 1, estimated_unit_cost: 0 }])}>
                      Add item
                    </Button>
                    <span className='text-sm font-medium'>Total: {formatAmount(itemsTotal, budgetLine)}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitRequisition} disabled={createRequisition.isPending}>{createRequisition.isPending ? 'Creating…' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load requisitions from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All requisitions</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(r) => r.name}
              isLoading={isLoading}
              onRowClick={(r) => setSelectedName(r.name)}
              densityStorageKey='requisitions'
              emptyState={{
                icon: FileSearch,
                title: 'No requisitions found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Requisitions will appear here once created.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent className='sm:max-w-lg'>
            <DialogHeader>
              <DialogTitle>{selected?.purpose}</DialogTitle>
              <DialogDescription>{selected?.name} · {selected?.budget_line}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-4 text-sm'>
                <div className='divide-y rounded-md border'>
                  {selected.items.map((it) => (
                    <div key={it.name} className='flex items-center justify-between px-3 py-2'>
                      <span>{it.description} × {it.quantity}</span>
                      {formatAmount(it.estimated_amount, selected.budget_line)}
                    </div>
                  ))}
                </div>
                <div className='flex justify-between font-medium'><span>Total estimated</span>{formatAmount(selected.total_estimated_amount, selected.budget_line)}</div>

                <div>
                  <p className='mb-1 text-xs font-medium text-muted-foreground'>
                    Quotations {requiredQuotes !== undefined && `(${selected.quotations.length} of ${requiredQuotes} required)`}
                  </p>
                  <div className='divide-y rounded-md border'>
                    {selected.quotations.length === 0 && <p className='px-3 py-3 text-sm text-muted-foreground'>No quotations logged yet.</p>}
                    {selected.quotations.map((q) => (
                      <div key={q.name} className='flex items-center justify-between px-3 py-2'>
                        <div>
                          <p>{q.vendor_name}</p>
                          <a href={q.quotation_document} target='_blank' rel='noreferrer' className='text-xs text-primary hover:underline'>View document</a>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Money usd={quoteAmountUsd(q)} />
                          {q.is_selected === 1 ? (
                            <StatusBadge tone='good'>Selected</StatusBadge>
                          ) : selected.status === 'Open' ? (
                            <Button size='sm' variant='outline' onClick={() => selectQuotation(q.vendor)} disabled={saveQuotations.isPending}>Select</Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.status === 'Open' && (
                  <div className='space-y-2 rounded-md border p-3'>
                    <p className='text-xs font-medium text-muted-foreground'>Add a quotation</p>
                    <div className='grid grid-cols-2 gap-2'>
                      <Select value={quoteVendor} onValueChange={setQuoteVendor}>
                        <SelectTrigger><SelectValue placeholder='Vendor' /></SelectTrigger>
                        <SelectContent>
                          {(vendors ?? []).map((v) => (
                            <SelectItem key={v.name} value={v.name}>{v.vendor_name}{v.approval_status !== 'Approved' ? ` (${v.approval_status})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={quoteCurrency} onValueChange={(v) => setQuoteCurrency(v as 'ZiG' | 'USD')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value='ZiG'>ZiG</SelectItem><SelectItem value='USD'>USD</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <Input type='number' min='0' step='0.01' placeholder='Quoted amount' value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} />
                    <input ref={fileInputRef} type='file' className='hidden' onChange={handleQuoteFile} />
                    <div className='flex items-center justify-between'>
                      <Button type='button' variant='outline' size='sm' onClick={() => fileInputRef.current?.click()} disabled={uploadingQuote}>
                        {uploadingQuote ? 'Uploading…' : quoteFileUrl ? 'Document attached' : 'Attach document'}
                      </Button>
                      <label className='flex items-center gap-1.5 text-xs'>
                        <input type='checkbox' checked={quoteSelected} onChange={(e) => setQuoteSelected(e.target.checked)} />
                        Mark selected
                      </label>
                    </div>
                    <Button size='sm' onClick={addQuotation} disabled={saveQuotations.isPending}>Add quotation</Button>
                  </div>
                )}
              </div>
            )}
            {selected && selected.status === 'Open' && (
              <DialogFooter>
                <Button
                  onClick={issue}
                  disabled={issuePO.isPending || !(requiredQuotes !== undefined && selected.quotations.length >= requiredQuotes && selected.quotations.some((q) => q.is_selected === 1))}
                >
                  {issuePO.isPending ? 'Issuing…' : 'Issue Purchase Order'}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
