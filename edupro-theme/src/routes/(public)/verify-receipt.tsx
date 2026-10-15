import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { BadgeCheck, ScanLine, ShieldAlert, ShieldX } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSchoolBranding } from '@/lib/frappe/school-setup'
import { zigToUsd } from '@/lib/currency'
import { useCurrentZigPerUsd } from '@/lib/frappe/exchange-rates'
import { useVerifyReceipt } from '@/lib/frappe/receipts'
import { Money } from '@/components/money'
import { FrappeApiError } from '@/lib/frappe/client'

export const Route = createFileRoute('/(public)/verify-receipt')({
  validateSearch: z.object({ receipt: z.string().optional(), token: z.string().optional() }),
  component: VerifyReceiptPage,
})

/** Public, no-login page -- verify_receipt() is guest-accessible by design
 * (see its docstring in the backend's receipt.py), so this route must live
 * outside _authenticated too, or the app's own auth guard would redirect a
 * scanning visitor to sign-in before they ever saw the result. */
function VerifyReceiptPage() {
  const { receipt, token } = Route.useSearch()
  const { data, error, isLoading } = useVerifyReceipt(receipt, token)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
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
            <ScanLine className='h-6 w-6' />
          </div>
          <h1 className='text-2xl font-bold tracking-tight'>Receipt Verification</h1>
          <p className='text-sm text-muted-foreground'>Confirms this receipt is genuine and unaltered.</p>
        </div>

        {(!receipt || !token) && (
          <Card>
            <CardContent className='py-8 text-center text-sm text-muted-foreground'>
              No receipt to verify. Scan a receipt's QR code, or open the verification link from a receipt PDF.
            </CardContent>
          </Card>
        )}

        {receipt && token && isLoading && (
          <Card><CardContent className='py-8 text-center text-sm text-muted-foreground'>Verifying {receipt}…</CardContent></Card>
        )}

        {receipt && error && (
          <Card className='border-destructive/50'>
            <CardHeader className='items-center text-center'>
              <ShieldAlert className='h-10 w-10 text-destructive' />
              <CardTitle className='text-destructive'>Could not verify</CardTitle>
              <CardDescription>
                {error instanceof FrappeApiError
                  ? (error.serverMessages?.[0] ?? 'Something went wrong checking this receipt.')
                  : 'Something went wrong checking this receipt.'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {data && (
          <Card className={data.valid ? 'border-emerald-500/50' : 'border-destructive/50'}>
            <CardHeader className='items-center text-center'>
              {data.valid ? (
                <>
                  <BadgeCheck className='h-10 w-10 text-emerald-600' />
                  <CardTitle className='text-emerald-600'>Genuine Receipt</CardTitle>
                  <CardDescription>This receipt's details match what was recorded -- it has not been altered.</CardDescription>
                </>
              ) : (
                <>
                  <ShieldX className='h-10 w-10 text-destructive' />
                  <CardTitle className='text-destructive'>Not Valid</CardTitle>
                  <CardDescription>{data.reason ?? 'This receipt failed verification -- it may have been tampered with.'}</CardDescription>
                </>
              )}
            </CardHeader>
            {data.receipt && (
              <CardContent className='grid grid-cols-2 gap-3 border-t pt-4 text-sm'>
                <div><p className='text-xs text-muted-foreground'>Receipt No.</p><p className='font-medium'>{data.receipt}</p></div>
                <div><p className='text-xs text-muted-foreground'>Date</p><p className='font-medium'>{data.posting_date}</p></div>
                <div><p className='text-xs text-muted-foreground'>Student</p><p className='font-medium'>{data.student}</p></div>
                {data.amount !== undefined && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Amount</p>
                    <p className='font-medium'>
                      <Money usd={data.currency === 'ZiG' ? zigToUsd(data.amount, zigPerUsd) : data.amount} />
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}
      </main>
    </div>
  )
}
