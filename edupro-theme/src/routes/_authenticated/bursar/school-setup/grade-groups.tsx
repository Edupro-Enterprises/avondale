import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Layers, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useGradeGroups, useCreateGradeGroup, type FrappeGradeGroup } from '@/lib/frappe/grade-groups'

export const Route = createFileRoute('/_authenticated/bursar/school-setup/grade-groups')({
  component: GradeGroupsPage,
})

const FILTER_GROUPS: FilterGroupDef[] = []

function GradeGroupsPage() {
  const { data: gradeGroups, isLoading, error } = useGradeGroups()
  const createGradeGroup = useCreateGradeGroup()
  const filters = useFilters('grade-groups', FILTER_GROUPS)

  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const rows = useMemo(() => gradeGroups ?? [], [gradeGroups])
  const filtered = useMemo(
    () => rows.filter((gg) => gg.grade_group_name.toLowerCase().includes(filters.search.toLowerCase())),
    [rows, filters.search]
  )

  async function submit() {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    try {
      await createGradeGroup.mutateAsync({ grade_group_name: name.trim(), description: description || undefined })
      toast.success('Grade group added')
      setAddOpen(false)
      setName('')
      setDescription('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this grade group.')
    }
  }

  const columns: DataListColumn<FrappeGradeGroup>[] = [
    { id: 'name', header: 'Name', sortable: true, sortValue: (gg) => gg.grade_group_name, cell: (gg) => gg.grade_group_name },
    { id: 'description', header: 'Description', sortable: true, sortValue: (gg) => gg.description ?? '', cell: (gg) => gg.description ?? '—' },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>School Setup · Academic Structure</p>
            <h1 className='text-3xl font-bold tracking-tight'>Grade Groups</h1>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add grade group</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a grade group</DialogTitle></DialogHeader>
              <div className='grid gap-3 py-2'>
                <CompactField label='Name'>
                  <Input className={compactControlClass} value={name} onChange={(e) => setName(e.target.value)} placeholder='Senior' />
                </CompactField>
                <CompactField label='Description'>
                  <Input className={compactControlClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Form 3 – Form 6' />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createGradeGroup.isPending}>{createGradeGroup.isPending ? 'Adding…' : 'Add group'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load grade groups from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All grade groups</CardTitle>
                <CardDescription>{filtered.length} of {rows.length}</CardDescription>
              </div>
              <FilterBar filters={filters} groups={FILTER_GROUPS} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(gg) => gg.name}
              isLoading={isLoading}
              densityStorageKey='grade-groups'
              emptyState={{
                icon: Layers,
                title: 'No grade groups found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Grade groups will appear here once added.',
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
