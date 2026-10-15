import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { BadgeCheck, FileScan, ShieldX } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSchoolBranding } from '@/lib/frappe/school-setup'
import { useVerifyStudentDocument } from '@/lib/frappe/students'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/(public)/verify-document')({
  validateSearch: z.object({ student: z.string().optional() }),
  component: VerifyDocumentPage,
})

/** Public, no-login page for a Statement or Profile PDF's QR code -- proves
 * the document points at a real, current student record. Public for the
 * same reason /verify-receipt is: a family shouldn't need to sign in on
 * someone else's phone just to confirm a document is genuine. */
function VerifyDocumentPage() {
  const { student } = Route.useSearch()
  const { data, error, isLoading } = useVerifyStudentDocument(student)
  const { data: branding } = useSchoolBranding()
  const logoUrl = branding?.school_logo || '/brand/edupro-logo.png'
  const schoolName = branding?.school_name || 'Edupro SMS'

  return (
    <div className='min-h-svh bg-background'>
      <header className='border-b'>
        <div className='mx-auto flex max-w-3xl items-center gap-3 px-4 py-4'>
          <img src={logoUrl} alt='' className='h-8 w-auto' />
          <span className='text-sm font-medium'>{schoolName}</span>
          <Link to='/sign-in' className='ml-auto text-sm text-muted-foreground underline underline-offset-4 hover:text-primary'>
            Sign in
          </Link>
        </div>
      </header>

      <main className='mx-auto max-w-md px-4 py-8'>
        <div className='mb-6 text-center'>
          <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <FileScan className='h-6 w-6' />
          </div>
          <h1 className='text-2xl font-bold tracking-tight'>Document Verification</h1>
          <p className='text-sm text-muted-foreground'>Confirms this document was generated from a real student record.</p>
        </div>

        {!student && (
          <Card>
            <CardContent className='py-8 text-center text-sm text-muted-foreground'>
              No student reference given. Scan a document's QR code to verify it.
            </CardContent>
          </Card>
        )}

        {student && isLoading && (
          <Card><CardContent className='py-8 text-center text-sm text-muted-foreground'>Verifying…</CardContent></Card>
        )}

        {student && error && (
          <Card className='border-destructive/50'>
            <CardHeader className='items-center text-center'>
              <ShieldX className='h-10 w-10 text-destructive' />
              <CardTitle className='text-destructive'>Could not verify</CardTitle>
              <CardDescription>Something went wrong checking this document.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {data && (
          <Card className={data.valid ? 'border-emerald-500/50' : 'border-destructive/50'}>
            <CardHeader className='items-center text-center'>
              {data.valid ? (
                <>
                  <BadgeCheck className='h-10 w-10 text-emerald-600' />
                  <CardTitle className='text-emerald-600'>Genuine Document</CardTitle>
                  <CardDescription>This document was generated from a real record at {data.school_name}.</CardDescription>
                </>
              ) : (
                <>
                  <ShieldX className='h-10 w-10 text-destructive' />
                  <CardTitle className='text-destructive'>Not Valid</CardTitle>
                  <CardDescription>{data.reason ?? 'This document could not be verified.'}</CardDescription>
                </>
              )}
            </CardHeader>
            {data.valid && (
              <CardContent className='grid grid-cols-2 gap-3 border-t pt-4 text-sm'>
                <div><p className='text-xs text-muted-foreground'>Student</p><p className='font-medium'>{formatStudentName(data.first_name ?? '', data.last_name ?? '')}</p></div>
                <div><p className='text-xs text-muted-foreground'>Class</p><p className='font-medium'>{data.grade ?? '—'}</p></div>
                <div><p className='text-xs text-muted-foreground'>Status</p><p className='font-medium'>{data.status}</p></div>
              </CardContent>
            )}
          </Card>
        )}
      </main>
    </div>
  )
}
