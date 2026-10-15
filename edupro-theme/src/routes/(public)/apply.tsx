import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { BadgeCheck, GraduationCap, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSchoolBranding } from '@/lib/frappe/school-setup'
import { useSubmitApplication } from '@/lib/frappe/applicants'
import { FrappeApiError } from '@/lib/frappe/client'

export const Route = createFileRoute('/(public)/apply')({
  component: ApplyPage,
})

const GRADES = ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7']

/** Public, no-login admissions application -- see submit_application() in
 * the backend's applicant.py. A prospective family applies without an
 * account; the Bursar reviews it in the existing Admissions > Applicants
 * screen exactly as if they'd entered it there themselves. */
function ApplyPage() {
  const { data: branding } = useSchoolBranding()
  const logoUrl = branding?.school_logo || '/brand/edupro-logo.png'
  const schoolName = branding?.school_name || 'Edupro SMS'
  const submitApplication = useSubmitApplication()

  const [childName, setChildName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState<string>('')
  const [entryGrade, setEntryGrade] = useState('')
  const [attendanceType, setAttendanceType] = useState<'Day Scholar' | 'Boarder'>('Day Scholar')
  const [guardianName, setGuardianName] = useState('')
  const [guardianRelationship, setGuardianRelationship] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [reference, setReference] = useState<string | null>(null)

  async function submit() {
    if (!childName.trim() || !dob || !guardianName.trim() || !guardianPhone.trim()) {
      toast.error('Child\'s name, date of birth, guardian name and phone are required.')
      return
    }
    try {
      const name = await submitApplication.mutateAsync({
        full_legal_name: childName.trim(),
        date_of_birth: dob,
        gender: (gender as 'Female' | 'Male') || undefined,
        entry_grade: entryGrade || undefined,
        attendance_type: attendanceType,
        guardian_name: guardianName.trim(),
        guardian_relationship: guardianRelationship || undefined,
        guardian_phone: guardianPhone.trim(),
        guardian_email: guardianEmail.trim() || undefined,
      })
      setReference(name)
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not submit the application. Please try again.')
    }
  }

  return (
    <div className='min-h-svh bg-background'>
      <header className='border-b'>
        <div className='mx-auto flex max-w-2xl items-center gap-3 px-4 py-4'>
          <img src={logoUrl} alt='' className='h-8 w-auto' />
          <span className='text-sm font-medium'>{schoolName}</span>
          <Link to='/sign-in' className='ml-auto text-sm text-muted-foreground underline underline-offset-4 hover:text-primary'>
            Sign in
          </Link>
        </div>
      </header>

      <main className='mx-auto max-w-2xl px-4 py-10'>
        {reference ? (
          <Card className='border-emerald-500/50'>
            <CardHeader className='items-center text-center'>
              <div className='mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600'>
                <BadgeCheck className='h-7 w-7' />
              </div>
              <CardTitle>Application received</CardTitle>
              <CardDescription>
                Reference <span className='font-medium text-foreground'>{reference}</span> -- the school's admissions office will contact you using the details you provided.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className='mb-6 flex items-center gap-3'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                <UserPlus className='h-5 w-5' />
              </div>
              <div>
                <h1 className='text-2xl font-bold tracking-tight'>Apply for a place</h1>
                <p className='text-sm text-muted-foreground'>No account needed -- the school's admissions office will review your application.</p>
              </div>
            </div>

            <Card>
              <CardHeader className='border-b'>
                <CardTitle className='flex items-center gap-2 text-base'><GraduationCap className='h-4 w-4 text-primary' />Child's details</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4 pt-4'>
                <div className='grid gap-2'>
                  <Label htmlFor='child-name'>Full legal name</Label>
                  <Input id='child-name' value={childName} onChange={(e) => setChildName(e.target.value)} />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='dob'>Date of birth</Label>
                    <Input id='dob' type='date' value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='gender'>Gender (optional)</Label>
                    <Select value={gender || '__unset__'} onValueChange={(v) => setGender(v === '__unset__' ? '' : v)}>
                      <SelectTrigger id='gender'><SelectValue placeholder='Select…' /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='__unset__'>Not set</SelectItem>
                        <SelectItem value='Female'>Female</SelectItem>
                        <SelectItem value='Male'>Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='entry-grade'>Grade applying for</Label>
                    <Select value={entryGrade || '__unset__'} onValueChange={(v) => setEntryGrade(v === '__unset__' ? '' : v)}>
                      <SelectTrigger id='entry-grade'><SelectValue placeholder='Select…' /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='__unset__'>Not sure</SelectItem>
                        {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='attendance'>Attendance type</Label>
                    <Select value={attendanceType} onValueChange={(v) => setAttendanceType(v as 'Day Scholar' | 'Boarder')}>
                      <SelectTrigger id='attendance'><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='Day Scholar'>Day Scholar</SelectItem>
                        <SelectItem value='Boarder'>Boarder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='mt-4'>
              <CardHeader className='border-b'>
                <CardTitle className='text-base'>Guardian contact</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4 pt-4'>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='guardian-name'>Full name</Label>
                    <Input id='guardian-name' value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='guardian-relationship'>Relationship</Label>
                    <Select value={guardianRelationship || '__unset__'} onValueChange={(v) => setGuardianRelationship(v === '__unset__' ? '' : v)}>
                      <SelectTrigger id='guardian-relationship'><SelectValue placeholder='Select…' /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='__unset__'>Not set</SelectItem>
                        <SelectItem value='Mother'>Mother</SelectItem>
                        <SelectItem value='Father'>Father</SelectItem>
                        <SelectItem value='Guardian'>Guardian</SelectItem>
                        <SelectItem value='Other'>Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='guardian-phone'>Phone</Label>
                    <Input id='guardian-phone' value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder='+263 77 …' />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='guardian-email'>Email (optional)</Label>
                    <Input id='guardian-email' type='email' value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button className='mt-6 w-full' onClick={submit} disabled={submitApplication.isPending}>
              {submitApplication.isPending ? 'Submitting…' : 'Submit application'}
            </Button>
          </>
        )}
      </main>
    </div>
  )
}
