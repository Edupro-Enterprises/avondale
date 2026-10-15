import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { FrappeApiError } from '@/lib/frappe/client'
import { useAcademicYears } from '@/lib/frappe/academic-years'
import { useClassStreams } from '@/lib/frappe/class-streams'
import {
  useAllGuardians,
  useBeneficiaryCategories,
  useCreateStudent,
  useUpdateStudent,
  type FrappeStudentDetail,
} from '@/lib/frappe/students'
import { formatStudentName } from '@/lib/utils'

const UNASSIGNED = '__unassigned__'
const STATUS_OPTIONS = ['Active', 'Suspended', 'Withdrawn', 'Transferred Out', 'Deceased', 'Graduated']

interface StudentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present in edit mode; absent when adding a new student. */
  student?: FrappeStudentDetail
  onSaved?: (studentName: string) => void
}

/** Fields are seeded from `student` only at mount -- callers must pass a
 * `key` that changes on open (e.g. `key={String(open)}`) to get a fresh form
 * each time, instead of syncing via effect. */

export function StudentFormDialog({ open, onOpenChange, student, onSaved }: StudentFormDialogProps) {
  const isEdit = !!student
  const { data: academicYears } = useAcademicYears()
  const { data: classStreams } = useClassStreams()
  const { data: guardians } = useAllGuardians()
  const createStudent = useCreateStudent()
  const updateStudent = useUpdateStudent()

  const [firstName, setFirstName] = useState(student?.first_name ?? '')
  const [lastName, setLastName] = useState(student?.last_name ?? '')
  const [dob, setDob] = useState(student?.date_of_birth ?? '')
  const [gender, setGender] = useState<string>(student?.gender ?? UNASSIGNED)
  const [admissionDate, setAdmissionDate] = useState(student?.admission_date ?? new Date().toISOString().slice(0, 10))
  const [academicYear, setAcademicYear] = useState(student?.academic_year ?? '')
  const [beneficiaryCategory, setBeneficiaryCategory] = useState<string>(student?.beneficiary_category ?? UNASSIGNED)
  const [grade, setGrade] = useState<string>(student?.grade ?? UNASSIGNED)
  const [guardian, setGuardian] = useState<string>(student?.guardian ?? UNASSIGNED)
  const [status, setStatus] = useState(student?.status ?? 'Active')
  const [homeAddress, setHomeAddress] = useState(student?.home_address ?? '')

  const isPending = createStudent.isPending || updateStudent.isPending

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required.')
      return
    }
    if (!admissionDate) {
      toast.error('Admission date is required.')
      return
    }
    if (!academicYear) {
      toast.error('Academic year is required.')
      return
    }
    if (beneficiaryCategory === UNASSIGNED) {
      toast.error('Beneficiary category is required.')
      return
    }

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dob || undefined,
      gender: gender === UNASSIGNED ? undefined : gender,
      admission_date: admissionDate,
      academic_year: academicYear,
      beneficiary_category: beneficiaryCategory,
      grade: grade === UNASSIGNED ? undefined : grade,
      guardian: guardian === UNASSIGNED ? undefined : guardian,
      home_address: homeAddress.trim() || undefined,
    }

    try {
      if (isEdit) {
        await updateStudent.mutateAsync({ name: student.name, ...payload, status })
        toast.success('Student updated')
        onSaved?.(student.name)
      } else {
        const name = await createStudent.mutateAsync(payload)
        toast.success('Student added')
        onSaved?.(name)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not save this student.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${formatStudentName(student.first_name, student.last_name)}` : 'Add a student'}</DialogTitle>
        </DialogHeader>
        <div className='grid grid-cols-2 gap-3 py-2'>
          <CompactField label='First name' required>
            <Input className={compactControlClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </CompactField>
          <CompactField label='Last name' required>
            <Input className={compactControlClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </CompactField>
          <CompactField label='Date of birth'>
            <Input type='date' className={compactControlClass} value={dob} onChange={(e) => setDob(e.target.value)} />
          </CompactField>
          <CompactField label='Gender'>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Not set</SelectItem>
                <SelectItem value='Female'>Female</SelectItem>
                <SelectItem value='Male'>Male</SelectItem>
              </SelectContent>
            </Select>
          </CompactField>
          <CompactField label='Admission date' required>
            <Input type='date' className={compactControlClass} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
          </CompactField>
          <CompactField label='Academic year' required>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select year' /></SelectTrigger>
              <SelectContent>
                {(academicYears ?? []).map((y) => (
                  <SelectItem key={y.name} value={y.name}>{y.academic_year_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CompactField>
          <CompactField label='Beneficiary category' required>
            <BeneficiaryCategorySelect value={beneficiaryCategory} onChange={setBeneficiaryCategory} />
          </CompactField>
          <CompactField label='Class / stream'>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className={compactControlClass}><SelectValue placeholder='Not enrolled' /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Not enrolled</SelectItem>
                {(classStreams ?? []).map((c) => (
                  <SelectItem key={c.name} value={c.stream_name}>{c.stream_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CompactField>
          <CompactField label='Primary guardian'>
            <Select value={guardian} onValueChange={setGuardian}>
              <SelectTrigger className={compactControlClass}><SelectValue placeholder='None linked' /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>None linked</SelectItem>
                {(guardians ?? []).map((g) => (
                  <SelectItem key={g.name} value={g.name}>{g.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CompactField>
          <CompactField label='Home address' className='col-span-2'>
            <Textarea className='text-sm' rows={2} value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
          </CompactField>
          {isEdit && (
            <CompactField label='Status'>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CompactField>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {isEdit ? 'Save changes' : 'Add student'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BeneficiaryCategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: categories } = useBeneficiaryCategories()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select category' /></SelectTrigger>
      <SelectContent>
        {(categories ?? []).map((c) => (
          <SelectItem key={c.name} value={c.name}>{c.category_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
