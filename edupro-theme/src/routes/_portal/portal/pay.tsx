import { useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Money } from '@/components/money'
import { useMyGuardian, useMyChildren } from '@/lib/frappe/students'
import { useInvoices, computeFeeStatus } from '@/lib/frappe/invoices'
import { usePaymentMethods } from '@/lib/frappe/receipts'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_portal/portal/pay')({
  validateSearch: (search: Record<string, unknown>) => ({
    studentId: typeof search.studentId === 'string' ? search.studentId : undefined,
  }),
  component: HowToPayPage,
})

function HowToPayPage() {
  const { studentId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: guardian } = useMyGuardian()
  const { data: children } = useMyChildren(guardian?.name)
  const { data: invoices } = useInvoices()
  const { data: paymentMethods } = usePaymentMethods()

  const student = useMemo(
    () => (children ?? []).find((c) => c.name === studentId) ?? (children ?? [])[0],
    [children, studentId]
  )
  const { balanceUSD } = computeFeeStatus((invoices ?? []).filter((i) => i.student === student?.name))

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>How to Pay</h1>
        <p className='text-sm text-muted-foreground'>Payments are recorded by the school's Bursar office once received — this portal doesn't yet support paying online directly.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding balance</CardTitle>
          {student && <CardDescription>{formatStudentName(student.first_name, student.last_name)} · {student.grade ?? '—'}</CardDescription>}
        </CardHeader>
        <CardContent className='space-y-4'>
          {(children ?? []).length > 1 && (
            <div className='grid gap-2'>
              <Label>Student</Label>
              <Select value={student?.name ?? ''} onValueChange={(v) => navigate({ search: { studentId: v } })}>
                <SelectTrigger className='w-full'><SelectValue placeholder='Select a child' /></SelectTrigger>
                <SelectContent>
                  {(children ?? []).map((c) => (
                    <SelectItem key={c.name} value={c.name}>{formatStudentName(c.first_name, c.last_name)} — {c.grade ?? '—'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Money usd={balanceUSD} className='text-2xl' />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'><Wallet className='h-4 w-4' />Accepted payment methods</CardTitle>
          <CardDescription>Pay via any of these, then bring or send proof of payment to the Bursar's office to have it posted to your child's account.</CardDescription>
        </CardHeader>
        <CardContent className='divide-y pt-0'>
          {(paymentMethods ?? []).map((m) => (
            <div key={m.name} className='flex items-center justify-between py-3'>
              <p className='text-sm font-medium'>{m.method_name}</p>
              <span className='text-xs text-muted-foreground'>{m.currency}</span>
            </div>
          ))}
          {(paymentMethods ?? []).length === 0 && (
            <p className='py-3 text-sm text-muted-foreground'>No payment methods on file yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
