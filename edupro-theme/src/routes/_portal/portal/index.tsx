import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { useMyGuardian, useMyChildren } from '@/lib/frappe/students'
import { useInvoices, computeFeeStatus, type FeeStatus } from '@/lib/frappe/invoices'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_portal/portal/')({
  component: PortalDashboard,
})

const statusTone: Record<FeeStatus, StatusTone> = {
  paid: 'good',
  partial: 'warning',
  overdue: 'bad',
  pending: 'neutral',
}

function PortalDashboard() {
  const { data: guardian } = useMyGuardian()
  const { data: children } = useMyChildren(guardian?.name)
  const { data: invoices } = useInvoices()

  const rows = useMemo(() => {
    const invoicesByStudent = new Map<string, typeof invoices>()
    for (const inv of invoices ?? []) {
      const list = invoicesByStudent.get(inv.student) ?? []
      list.push(inv)
      invoicesByStudent.set(inv.student, list)
    }
    return (children ?? []).map((child) => ({
      child,
      ...computeFeeStatus(invoicesByStudent.get(child.name) ?? []),
    }))
  }, [children, invoices])

  const totalOutstanding = rows.reduce((sum, r) => sum + r.balanceUSD, 0)

  return (
    <div className='space-y-6'>
      <div>
        <p className='text-sm text-muted-foreground'>Good day, {(guardian?.full_name ?? '').split(' ')[0]}</p>
        <h1 className='text-2xl font-bold tracking-tight'>Family overview</h1>
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>Total outstanding, all children</CardTitle>
        </CardHeader>
        <CardContent className='flex items-center justify-between'>
          <Money usd={totalOutstanding} className='text-3xl' />
          {totalOutstanding > 0 && (
            <Button asChild size='sm'>
              <Link to='/portal/pay' search={{ studentId: undefined }}>
                <Wallet className='h-4 w-4' />
                How to pay
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className='space-y-3'>
        {rows.map(({ child, status, balanceUSD }) => (
          <Link key={child.name} to='/portal/students/$studentId' params={{ studentId: child.name }}>
            <Card className='transition-colors hover:bg-muted/50'>
              <CardContent className='flex items-center justify-between py-4'>
                <div>
                  <p className='font-medium'>{formatStudentName(child.first_name, child.last_name)}</p>
                  <CardDescription>{child.grade ?? '—'} · {child.current_term ?? '—'}</CardDescription>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='text-right'>
                    <Money usd={balanceUSD} compact />
                    <p className='text-xs text-muted-foreground'>outstanding</p>
                  </div>
                  <StatusBadge tone={statusTone[status]}>{status}</StatusBadge>
                  <ArrowRight className='h-4 w-4 text-muted-foreground' />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
