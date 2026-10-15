import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import { SchoolHeadHeader } from '@/components/layout/school-head-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useCashUps, useCashUp, useResolveCashUp, type FrappeCashUp } from '@/lib/frappe/cash-ups'

export const Route = createFileRoute('/_school-head/school-head/cash-ups')({
  component: SchoolHeadCashUpsPage,
})

const statusTone: Record<FrappeCashUp['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  Balanced: 'good',
  'Variance Flagged': 'bad',
  Resolved: 'good',
}

function SchoolHeadCashUpsPage() {
  const { data: cashUps, isLoading, error } = useCashUps()
  const flagged = (cashUps ?? []).filter((c) => c.workflow_state === 'Variance Flagged')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const { data: selected } = useCashUp(selectedName ?? undefined)
  const [notes, setNotes] = useState('')
  const resolveCashUp = useResolveCashUp()

  async function resolve() {
    if (!selectedName) return
    try {
      await resolveCashUp.mutateAsync({ name: selectedName, notes: notes.trim() || undefined })
      toast.success(`${selectedName} resolved`)
      setSelectedName(null)
      setNotes('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not resolve this cash-up.')
    }
  }

  const columns: DataListColumn<FrappeCashUp>[] = [
    { id: 'cashier', header: 'Cashier', sortable: true, sortValue: (c) => c.cashier, cell: (c) => c.cashier },
    { id: 'date', header: 'Date', sortable: true, sortValue: (c) => c.cash_up_date, cell: (c) => c.cash_up_date },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (c) => c.workflow_state,
      cell: (c) => <StatusBadge tone={statusTone[c.workflow_state]}>{c.workflow_state}</StatusBadge>,
    },
  ]

  return (
    <>
      <SchoolHeadHeader />
      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Cash-Ups</h1>
          <p className='text-sm text-muted-foreground'>A cashier is locked out of new receipts until you resolve their most recent flagged variance.</p>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load cash-ups from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>Flagged for your review</CardTitle>
            <CardDescription>{flagged.length} awaiting resolution</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={flagged}
              columns={columns}
              getRowId={(c) => c.name}
              isLoading={isLoading}
              onRowClick={(c) => setSelectedName(c.name)}
              densityStorageKey='school-head-cash-ups'
              emptyState={{ icon: Banknote, title: 'No cash-ups flagged', description: 'A variance-flagged cash-up will appear here.' }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => { if (!o) { setSelectedName(null); setNotes('') } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
              <DialogDescription>{selected?.cashier} · {selected?.cash_up_date}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='divide-y rounded-md border'>
                  {selected.lines.map((line) => (
                    <div key={line.payment_method} className='flex items-center justify-between px-3 py-2'>
                      <span className='text-muted-foreground'>{line.payment_method}</span>
                      <div className='flex items-center gap-3'>
                        <span>System <Money usd={line.system_amount} compact /></span>
                        <span>Counted <Money usd={line.counted_amount} compact /></span>
                        <span className={line.variance !== 0 ? 'font-medium text-destructive' : 'font-medium'}>
                          Variance <Money usd={line.variance} compact />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {selected.notes && <p className='text-muted-foreground'>{selected.notes}</p>}
                <div className='grid gap-2'>
                  <Label htmlFor='resolve-notes'>Resolution notes (optional)</Label>
                  <Textarea id='resolve-notes' value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='How was this variance explained?' />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button disabled={resolveCashUp.isPending} onClick={resolve}>{resolveCashUp.isPending ? 'Resolving…' : 'Resolve'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
