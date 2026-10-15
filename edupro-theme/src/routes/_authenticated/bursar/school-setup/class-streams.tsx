import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, School, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { StatusBadge } from '@/components/status-badge'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FilterBar } from '@/components/filter-bar'
import { useFilters, type FilterGroupDef } from '@/hooks/use-filters'
import { DataList, type DataListColumn } from '@/components/data-list'
import { FrappeApiError } from '@/lib/frappe/client'
import { useGradeGroups } from '@/lib/frappe/grade-groups'
import { useStudents, useUpdateStudent, type FrappeStudent } from '@/lib/frappe/students'
import { useClassStreams, useCreateClassStream, type FrappeClassStream } from '@/lib/frappe/class-streams'
import { ImportDialog } from '@/components/import-dialog'
import { formatStudentName } from '@/lib/utils'

const STUDENT_STATUSES = ['Active', 'Suspended', 'Withdrawn', 'Transferred Out', 'Deceased', 'Graduated']

export const Route = createFileRoute('/_authenticated/bursar/school-setup/class-streams')({
  component: ClassStreamsPage,
})

function ClassStreamsPage() {
  const { data: classStreams, isLoading, error } = useClassStreams()
  const { data: gradeGroups } = useGradeGroups()
  const { data: students } = useStudents()
  const createClassStream = useCreateClassStream()

  const [addOpen, setAddOpen] = useState(false)
  const [streamName, setStreamName] = useState('')
  const [gradeGroup, setGradeGroup] = useState('')
  const [capacity, setCapacity] = useState('')
  const [roster, setRoster] = useState<FrappeClassStream | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const updateStudentForImport = useUpdateStudent()

  const gradeGroupNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const gg of gradeGroups ?? []) map.set(gg.name, gg.grade_group_name)
    return map
  }, [gradeGroups])

  const enrolment = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of students ?? []) if (s.grade) counts.set(s.grade, (counts.get(s.grade) ?? 0) + 1)
    return counts
  }, [students])

  const rows = useMemo(() => classStreams ?? [], [classStreams])

  /** "Grade" and "Class" aren't separate backend fields -- a stream is one
   * free-text name like "Grade 1 A" or "ECD A A" -- so they're derived here
   * from the naming convention (last token is always the single-letter
   * section, everything before it is the grade level) rather than parsed
   * server-side. */
  function parseStream(streamName: string): { level: string; section: string } {
    const tokens = streamName.trim().split(' ')
    const section = tokens[tokens.length - 1] ?? ''
    const level = tokens.slice(0, -1).join(' ')
    return { level, section }
  }

  const filterGroups: FilterGroupDef[] = useMemo(
    () => [
      { key: 'grade', label: 'Grade', options: [...new Set(rows.map((cs) => parseStream(cs.stream_name).level))].sort() },
      { key: 'section', label: 'Class', options: [...new Set(rows.map((cs) => parseStream(cs.stream_name).section))].sort() },
    ],
    [rows]
  )
  const filters = useFilters('class-streams', filterGroups)

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return rows.filter((cs) => {
      const { level, section } = parseStream(cs.stream_name)
      const matchesSearch = cs.stream_name.toLowerCase().includes(search)
      const matchesGrade = !filters.values.grade || level === filters.values.grade
      const matchesSection = !filters.values.section || section === filters.values.section
      return matchesSearch && matchesGrade && matchesSection
    })
  }, [rows, filters.search, filters.values])

  async function submit() {
    if (!streamName.trim() || !gradeGroup) {
      toast.error('Stream name and grade group are required.')
      return
    }
    try {
      await createClassStream.mutateAsync({ stream_name: streamName.trim(), grade_group: gradeGroup, capacity: capacity ? Number(capacity) : undefined })
      toast.success('Class stream added')
      setAddOpen(false)
      setStreamName('')
      setGradeGroup('')
      setCapacity('')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not add this class stream.')
    }
  }

  const columns: DataListColumn<FrappeClassStream>[] = [
    {
      id: 'name',
      header: 'Class Stream',
      sortable: true,
      sortValue: (cs) => cs.stream_name,
      className: 'min-w-40',
      cell: (cs) => (
        <div className='flex flex-col'>
          <span className='truncate'>{cs.stream_name}</span>
          <span className='truncate text-xs text-muted-foreground'>{gradeGroupNames.get(cs.grade_group) ?? cs.grade_group}</span>
        </div>
      ),
    },
    {
      id: 'enrolment',
      header: 'Enrolment',
      sortable: true,
      sortValue: (cs) => enrolment.get(cs.stream_name) ?? 0,
      cell: (cs) => {
        const count = enrolment.get(cs.stream_name) ?? 0
        const over = cs.capacity ? count > cs.capacity : false
        return <StatusBadge tone={over ? 'bad' : 'neutral'}>{count}{cs.capacity ? ` / ${cs.capacity}` : ''} enrolled</StatusBadge>
      },
    },
  ]

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>School Setup · Academic Structure</p>
            <h1 className='text-3xl font-bold tracking-tight'>Class Streams</h1>
            <p className='text-sm text-muted-foreground'>Enrolment is matched to students whose grade/form exactly equals this stream's name.</p>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' onClick={() => setImportOpen(true)}>
              <Upload className='h-4 w-4' />
              Import enrollment
            </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className='h-4 w-4' />Add class stream</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a class stream</DialogTitle></DialogHeader>
              <div className='grid grid-cols-2 gap-3 py-2'>
                <CompactField label='Name' className='col-span-2'>
                  <Input className={compactControlClass} value={streamName} onChange={(e) => setStreamName(e.target.value)} placeholder='Form 4C' />
                </CompactField>
                <CompactField label='Grade group'>
                  <Select value={gradeGroup} onValueChange={setGradeGroup}>
                    <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                    <SelectContent>{(gradeGroups ?? []).map((gg) => <SelectItem key={gg.name} value={gg.name}>{gg.grade_group_name}</SelectItem>)}</SelectContent>
                  </Select>
                </CompactField>
                <CompactField label='Capacity'>
                  <Input type='number' className={compactControlClass} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder='45' />
                </CompactField>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={createClassStream.isPending}>{createClassStream.isPending ? 'Adding…' : 'Add stream'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <ImportDialog<{ studentId: string; newClass: string }>
          open={importOpen}
          onOpenChange={setImportOpen}
          title='Import enrollment'
          description='Moves existing students into a class by Student ID -- both columns are required. Does not create new students.'
          templateFilename='class-enrollment-import-template.xlsx'
          templateHeaders={['Student ID', 'New Class']}
          templateSample={['AV20001', 'Grade 1 L']}
          parseRow={(row) => {
            if (!row['Student ID']) return { error: 'Missing Student ID' }
            if (!row['New Class']) return { error: 'Missing New Class' }
            if (!(students ?? []).some((s) => s.name === row['Student ID'])) return { error: 'No such Student ID' }
            return { value: { studentId: row['Student ID'], newClass: row['New Class'] } }
          }}
          rowLabel={(r) => `${r.studentId} → ${r.newClass}`}
          commitRow={async (r) => { await updateStudentForImport.mutateAsync({ name: r.studentId, grade: r.newClass }) }}
        />

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load class streams from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader className='border-b'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <CardTitle>All class streams</CardTitle>
                <CardDescription>{filtered.length} of {rows.length} streams</CardDescription>
              </div>
              <FilterBar filters={filters} groups={filterGroups} searchPlaceholder='Search…' />
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <DataList
              data={filtered}
              columns={columns}
              getRowId={(cs) => cs.name}
              isLoading={isLoading}
              onRowClick={(cs) => setRoster(cs)}
              densityStorageKey='class-streams'
              emptyState={{
                icon: School,
                title: 'No class streams found',
                description: filters.activeCount > 0 ? 'Try adjusting your search or filters.' : 'Class streams will appear here once added.',
                actionLabel: filters.activeCount > 0 ? 'Clear filters' : undefined,
                onAction: filters.activeCount > 0 ? filters.clearAll : undefined,
              }}
            />
          </CardContent>
        </Card>

        {roster && (
          <ClassRosterDialog
            classStream={roster}
            allStreams={rows}
            students={(students ?? []).filter((s) => s.grade === roster.stream_name)}
            onClose={() => setRoster(null)}
          />
        )}
      </Main>
    </>
  )
}

function ClassRosterDialog({
  classStream,
  allStreams,
  students,
  onClose,
}: {
  classStream: FrappeClassStream
  allStreams: FrappeClassStream[]
  students: FrappeStudent[]
  onClose: () => void
}) {
  const updateStudent = useUpdateStudent()

  async function handleClassChange(student: FrappeStudent, newClass: string) {
    try {
      await updateStudent.mutateAsync({ name: student.name, grade: newClass })
      toast.success(`${formatStudentName(student.first_name, student.last_name)} moved to ${newClass}`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not move this student.')
    }
  }

  async function handleStatusChange(student: FrappeStudent, status: string) {
    try {
      await updateStudent.mutateAsync({ name: student.name, status })
      toast.success(`${formatStudentName(student.first_name, student.last_name)} marked ${status}`)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update this student.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Users className='h-4 w-4 text-primary' />
            {classStream.stream_name}
          </DialogTitle>
          <DialogDescription>{students.length} students enrolled -- change class or status directly from here.</DialogDescription>
        </DialogHeader>
        <div className='max-h-[60vh] divide-y overflow-y-auto rounded-md border'>
          {students.length === 0 && (
            <p className='px-3 py-6 text-center text-sm text-muted-foreground'>No students in this class yet.</p>
          )}
          {students.map((s) => (
            <div key={s.name} className='grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2'>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>{formatStudentName(s.first_name, s.last_name)}</p>
                <p className='text-xs text-muted-foreground'>{s.name}</p>
              </div>
              <Select value={s.grade ?? ''} onValueChange={(v) => handleClassChange(s, v)}>
                <SelectTrigger className='h-8 w-36 text-xs'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allStreams.map((cs) => <SelectItem key={cs.name} value={cs.stream_name}>{cs.stream_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={s.status} onValueChange={(v) => handleStatusChange(s, v)}>
                <SelectTrigger className='h-8 w-32 text-xs'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDENT_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
