import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Landmark, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useAccounts } from '@/lib/frappe/accounts'
import { useSchoolSetup, useUpdateSchoolSetup, type FrappeBankingConfigRow } from '@/lib/frappe/school-setup'

export const Route = createFileRoute('/_authenticated/bursar/school-setup/bank-accounts')({
  component: BankAccountsPage,
})

const FILTER_GROUPS: FilterGroupDef[] = [{ key: 'active', label: 'Status', options: ['Active', 'Inactive'] }]

type RowInput = Omit<FrappeBankingConfigRow, 'name'>

const emptyRow: RowInput = {
  bank_name: '',
  account_name: '',
  account_number: '',
  branch: '',
  swift_code: '',
  currency_type: 'ZiG',
  fee_stream: 'Tuition',
  is_active: 1,
  account: '',
}

function BankAccountsPage() {
  const { data: schoolSetup, isLoading, error } = useSchoolSetup()
  const { data: accounts } = useAccounts()
  const updateSchoolSetup = useUpdateSchoolSetup()
  const filters = useFilters('bank-accounts', FILTER_GROUPS)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<RowInput>(emptyRow)

  const rows = useMemo(() => schoolSetup?.banking_configuration ?? [], [schoolSetup])
  const filtered = useMemo(
    () =>
      rows.filter(
        (acc) =>
          (acc.account_name.toLowerCase().includes(filters.search.toLowerCase()) || acc.bank_name.toLowerCase().includes(filters.search.toLowerCase())) &&
          (!filters.values.active || (filters.values.active === 'Active' ? acc.is_active === 1 : acc.is_active !== 1))
      ),
    [rows, filters.search, filters.values]
  )

  async function submitAdd() {
    if (!schoolSetup) return
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      toast.error('Bank name, account name and account number are all required.')
      return
    }
    const nextRows: RowInput[] = [...rows.map(({ name: _n, ...rest }) => rest), form]
    try {
      await updateSchoolSetup.mutateAsync({ name: schoolSetup.name, input: { banking_configuration: nextRows } })
      toast.success('Bank account added')
      setAddOpen(false)
      setForm(emptyRow)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not save this bank account.')
    }
  }

  async function toggleActive(row: FrappeBankingConfigRow) {
    if (!schoolSetup) return
    const nextRows: RowInput[] = rows.map(({ name: _n, ...rest }) =>
      rest.account_number === row.account_number && rest.bank_name === row.bank_name ? { ...rest, is_active: rest.is_active === 1 ? 0 : 1 } : rest
    )
    try {
      await updateSchoolSetup.mutateAsync({ name: schoolSetup.name, input: { banking_configuration: nextRows } })
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this account.')
    }
  }

  async function removeRow(row: FrappeBankingConfigRow) {
    if (!schoolSetup) return
    const nextRows: RowInput[] = rows.filter((r) => r.name !== row.name).map(({ name: _n, ...rest }) => rest)
    try {
      await updateSchoolSetup.mutateAsync({ name: schoolSetup.name, input: { banking_configuration: nextRows } })
      toast.success('Bank account removed')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not remove this account.')
    }
  }

  const columns: DataListColumn<FrappeBankingConfigRow>[] = [
    {
      id: 'label',
      header: 'Account',
      sortable: true,
      sortValue: (acc) => acc.account_name,
      className: 'min-w-48',
      cell: (acc) => (
        <div className='flex flex-col'>
          <span className='truncate'>{acc.account_name}</span>
          <span className='truncate text-xs text-muted-foreground'>{acc.bank_name} · {acc.account_number} · {acc.fee_stream} · {acc.currency_type}</span>
        </div>
      ),
    },
    {
      id: 'active',
      header: 'Status',
      sortable: true,
      sortValue: (acc) => acc.is_active,
      cell: (acc) => (
        <button onClick={() => toggleActive(acc)} disabled={updateSchoolSetup.isPending}>
          <StatusBadge tone={acc.is_active === 1 ? 'good' : 'neutral'}>{acc.is_active === 1 ? 'Active' : 'Inactive'}</StatusBadge>
        </button>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: (acc) => (
        <Button variant='ghost' size='icon' onClick={() => removeRow(acc)} disabled={updateSchoolSetup.isPending} aria-label={`Remove ${acc.account_name}`}>
          <Trash2 className='h-4 w-4' />
        </Button>
      ),
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>School Setup</p>
            <h1 className='text-3xl font-bold tracking-tight'>Bank Accounts</h1>
            <p className='text-sm text-muted-foreground'>Requires at least one active Tuition and one active Levy/SDC account, each with both a ZiG and an FCA (USD) variant.</p>
          </div>
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (o) setForm(emptyRow) }}>
            <DialogTrigger asChild>
              <Button disabled={!schoolSetup}><Plus className='h-4 w-4' />Add account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a bank account</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Bank name'>
                  <Input className={compactControlClass} value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} placeholder='CBZ Bank' />
                </CompactField>
                <CompactField label='Account name'>
                  <Input className={compactControlClass} value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} placeholder='Tuition & General' />
                </CompactField>
                <CompactField label='Account number'>
                  <Input className={compactControlClass} value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />
                </CompactField>
                <CompactField label='Branch'>
                  <Input className={compactControlClass} value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} />
                </CompactField>
                <CompactField label='SWIFT code'>
                  <Input className={compactControlClass} value={form.swift_code} onChange={(e) => setForm((f) => ({ ...f, swift_code: e.target.value }))} />
                </CompactField>
                <CompactField label='Currency'>
                  <Select value={form.currency_type} onValueChange={(v) => setForm((f) => ({ ...f, currency_type: v as RowInput['currency_type'] }))}>
                    <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value='ZiG'>ZiG</SelectItem><SelectItem value='FCA'>FCA (USD)</SelectItem></SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Fee stream'>
                  <Select value={form.fee_stream} onValueChange={(v) => setForm((f) => ({ ...f, fee_stream: v as RowInput['fee_stream'] }))}>
                    <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='Tuition'>Tuition</SelectItem>
                      <SelectItem value='Levy/SDC'>Levy/SDC</SelectItem>
                      <SelectItem value='Boarding'>Boarding</SelectItem>
                      <SelectItem value='Project'>Project</SelectItem>
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Ledger account'>
                  <Select value={form.account} onValueChange={(v) => setForm((f) => ({ ...f, account: v }))}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Optional' /></SelectTrigger>
                    <SelectContent>{(accounts ?? []).filter((a) => a.account_type === 'Asset').map((a) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submitAdd} disabled={updateSchoolSetup.isPending}>{updateSchoolSetup.isPending ? 'Saving…' : 'Add account'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load bank accounts from the server. Try refreshing the page.</CardContent></Card>
        )}
        {!isLoading && !schoolSetup && (
          <Card className='mb-6'><CardContent className='py-4 text-sm text-muted-foreground'>No School Setup record exists yet -- see Institution Profile.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>Configured accounts</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search by name or bank…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(acc) => acc.name}
              isLoading={isLoading}
              densityStorageKey='bank-accounts'
              emptyState={{
                icon: Landmark,
                title: 'No bank accounts found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Accounts will appear here once added.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
