import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useMyStudent, useGuardians } from '@/lib/frappe/students'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_student/student/settings')({
  component: StudentSettingsPage,
})

function StudentSettingsPage() {
  const { data: student, isLoading } = useMyStudent()
  const guardianNames = useMemo(() => [student?.guardian].filter((g): g is string => !!g), [student?.guardian])
  const { data: guardians } = useGuardians(guardianNames)
  const guardian = guardians?.[0]

  if (!isLoading && !student) {
    return (
      <Card>
        <CardContent className='py-10 text-center text-sm text-muted-foreground'>
          Your account isn't linked to a student record yet. Ask your school's office to link it.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Account Settings</h1>
        <p className='text-sm text-muted-foreground'>Read-only — contact your Bursar's office to update these details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My details</CardTitle>
          <CardDescription>As held on the school's registry.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-2'>
            <Label>Full name</Label>
            <Input value={student ? formatStudentName(student.first_name, student.last_name) : ''} disabled />
          </div>
          <div className='grid gap-2'>
            <Label>Grade</Label>
            <Input value={student?.grade ?? ''} disabled />
          </div>
          <div className='grid gap-2'>
            <Label>Beneficiary category</Label>
            <Input value={student?.beneficiary_category ?? ''} disabled />
          </div>
          <div className='grid gap-2'>
            <Label>Guardian</Label>
            <Input value={guardian ? `${guardian.full_name}${guardian.phone_number ? ` · ${guardian.phone_number}` : ''}` : 'Not on file'} disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
