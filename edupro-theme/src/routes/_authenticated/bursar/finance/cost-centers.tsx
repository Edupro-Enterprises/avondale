import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Wallet2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useCostCenters, useCreateCostCenter, type FrappeCostCenter } from '@/lib/frappe/cost-centers'

export const Route = createFileRoute('/_authenticated/bursar/finance/cost-centers')({
  component: CostCentersPage,
})

const columns: DataListColumn<FrappeCostCenter>[] = [
  { id: 'name', header: 'Name', sortable: true, sortValue: (cc) => cc.name, cell: (cc) => cc.name },
  { id: 'description', header: 'Description', sortable: true, sortValue: (cc) => cc.description ?? '', cell: (cc) => cc.description ?? '—' },
]

function CostCentersPage() {
  const { data: costCenters, isLoading, error } = useCostCenters()
  const createCostCenter = useCreateCostCenter()
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function submit() {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    try {
      await createCostCenter.mutateAsync({ cost_center_name: name.trim(), description: description || undefined })
      toast.success('Cost center added')
      setAddOpen(false)
      setName('')
      setDescription('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this cost center.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Finance</p>
            <h1 className='text-3xl font-bold tracking-tight'>Cost Centers</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add cost center</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a cost center</DialogTitle></DialogHeader>
              <div className='grid gap-3 py-2'>
                <CompactField label='Name'>
                  <Input className={compactControlClass} value={name} onChange={(e) => setName(e.target.value)} placeholder='Boarding' />
                </CompactField>
                <CompactField label='Description'>
                  <Input className={compactControlClass} value={description} onChange={(e) => setDescription(e.target.value)} />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createCostCenter.isPending}>{createCostCenter.isPending ? 'Adding…' : 'Add cost center'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'>
            <CardContent className='py-4 text-sm text-destructive'>Couldn't load cost centers from the server. Try refreshing the page.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <CardTitle>All cost centers</CardTitle>
            <CardDescription>{(costCenters ?? []).length} cost centers</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={costCenters ?? []}
              columns={columns}
              getRowId={(cc) => cc.name}
              isLoading={isLoading}
              densityStorageKey='cost-centers'
              emptyState={{ icon: Wallet2, title: 'No cost centers found', description: 'Cost centers will appear here once added.' }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
