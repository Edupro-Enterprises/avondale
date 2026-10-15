import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FilePlus2, FileSearch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { useFeeStructures, useFeeStructure, type FrappeFeeStructure } from '@/lib/frappe/fee-structures'

export const Route = createFileRoute('/_authenticated/bursar/billing/fee-structures')({
  component: FeeStructuresPage,
})

const statusTone: Record<FrappeFeeStructure['workflow_state'], StatusTone> = {
  Draft: 'neutral',
  'Pending Approval': 'warning',
  Approved: 'good',
  Rejected: 'bad',
}

function FeeStructuresPage() {
  const { data: feeStructures, isLoading, error } = useFeeStructures()
  const [draftOpen, setDraftOpen] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const { data: selected } = useFeeStructure(selectedName ?? undefined)

  const rows = useMemo(() => feeStructures ?? [], [feeStructures])

  const filterGroups: FilterGroupDef[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: ['Draft', 'Pending Approval', 'Approved', 'Rejected'] },
      { key: 'year', label: 'Academic Year', options: [...new Set(rows.map((fs) => fs.academic_year))].sort().reverse() },
      { key: 'term', label: 'Term', options: [...new Set(rows.map((fs) => fs.term))].sort() },
      { key: 'category', label: 'Category', options: [...new Set(rows.map((fs) => fs.beneficiary_category).filter((c): c is string => !!c))].sort() },
    ],
    [rows]
  )
  const filters = useFilters('fee-structures', filterGroups)

  const filtered = useMemo(
    () =>
      rows.filter(
        (fs) =>
          fs.structure_name.toLowerCase().includes(filters.search.toLowerCase()) &&
          (!filters.values.status || fs.workflow_state === filters.values.status) &&
          (!filters.values.year || fs.academic_year === filters.values.year) &&
          (!filters.values.term || fs.term === filters.values.term) &&
          (!filters.values.category || fs.beneficiary_category === filters.values.category)
      ),
    [rows, filters.search, filters.values]
  )

  const columns: DataListColumn<FrappeFeeStructure>[] = [
    {
      id: 'name',
      header: 'Fee Structure',
      sortable: true,
      sortValue: (fs) => fs.structure_name,
      className: 'min-w-48',
      cell: (fs) => fs.structure_name,
    },
    { id: 'year', header: 'Academic Year', sortable: true, sortValue: (fs) => fs.academic_year, cell: (fs) => fs.academic_year },
    { id: 'term', header: 'Term', sortable: true, sortValue: (fs) => fs.term, cell: (fs) => fs.term },
    { id: 'category', header: 'Category', sortable: true, sortValue: (fs) => fs.beneficiary_category ?? '', cell: (fs) => fs.beneficiary_category ?? 'All categories' },
    {
      id: 'total',
      header: 'Total',
      sortable: true,
      sortValue: (fs) => fs.total_amount,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (fs) => <Money usd={fs.total_amount} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (fs) => fs.workflow_state,
      cell: (fs) => <StatusBadge tone={statusTone[fs.workflow_state]}>{fs.workflow_state}</StatusBadge>,
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Billing</p>
            <h1 className='text-3xl font-bold tracking-tight'>Fee Structures</h1>
            <p className='text-sm text-muted-foreground'>Draft (Bursar) &rarr; Pending Approval (Fees Approver) &rarr; Approved. Co-signed by School Head and SDC.</p>
          </div>
          <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
            <DialogTrigger asChild>
              <Button>
                <FilePlus2 className='h-4 w-4' />
                Draft fee structure
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Draft a fee structure</DialogTitle>
                <DialogDescription>
                  Full fee-item line building is coming soon -- for now, drafting happens on the desk.
                </DialogDescription>
              </DialogHeader>
              <div className='grid gap-4 py-2'>
                <div className='grid gap-2'>
                  <Label htmlFor='name'>Name</Label>
                  <Input id='name' placeholder='Day Scholar — Term 2 Fees' />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='term'>Term</Label>
                  <Input id='term' placeholder='Term 2' />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    toast.info('Line-item drafting is coming soon -- create this Fee Structure on the desk for now')
                    setDraftOpen(false)
                  }}
                >
                  Submit draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>
              Couldn't load fee structures from the server. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All fee structures</CardTitle>
                <CardDescription>
                  {filtered.length} of {rows.length}
                </CardDescription>
              </div>
              <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(fs) => fs.name}
              isLoading={isLoading}
              onRowClick={(fs) => setSelectedName(fs.name)}
              densityStorageKey='fee-structures'
              emptyState={{
                icon: FileSearch,
                title: 'No fee structures found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Fee structures will appear here once drafted.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={!!selectedName} onOpenChange={(o) => !o && setSelectedName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected?.structure_name}</DialogTitle>
              <DialogDescription>
                {selected?.name}
                {selected?.revision_of && ` · revision of ${selected.revision_of}`}
              </DialogDescription>
            </DialogHeader>
            {selected && (
              <div className='space-y-3 text-sm'>
                <div className='divide-y rounded-md border'>
                  {selected.items.map((li, i) => (
                    <div key={`${li.fee_item}-${i}`} className='flex items-center justify-between px-3 py-2'>
                      <span>{li.fee_item}</span>
                      {li.currency === 'ZiG' ? <span>{li.amount.toFixed(2)} ZiG</span> : <Money usd={li.amount} />}
                    </div>
                  ))}
                </div>
                <div className='flex justify-between font-medium'><span>Total</span><Money usd={selected.total_amount} /></div>
                <div className='space-y-1 border-t pt-3 text-xs text-muted-foreground'>
                  <p>Drafted by {selected.owner}</p>
                  {selected.school_head_co_signed_by && <p>School Head co-signed by {selected.school_head_co_signed_by} on {selected.school_head_co_signed_on}</p>}
                  {selected.sdc_co_signed_by && <p>SDC co-signed by {selected.sdc_co_signed_by} on {selected.sdc_co_signed_on}</p>}
                  {selected.approved_by && <p>Approved by {selected.approved_by} on {selected.approved_on}</p>}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}
