import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription } from '@/components/ui/card'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { useMyGuardian, useMyChildren } from '@/lib/frappe/students'
import { useInvoices, computeFeeStatus, type FeeStatus } from '@/lib/frappe/invoices'
import { formatStudentName } from '@/lib/utils'

export const Route = createFileRoute('/_portal/portal/students/')({
  component: MyChildrenPage,
})

const statusTone: Record<FeeStatus, StatusTone> = {
  paid: 'good',
  partial: 'warning',
  overdue: 'bad',
  pending: 'neutral',
}

function MyChildrenPage() {
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

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>My Children</h1>
        <p className='text-sm text-muted-foreground'>{rows.length} enrolled</p>
      </div>

      <div className='space-y-3'>
        {rows.map(({ child, status, balanceUSD }) => (
          <Link key={child.name} to='/portal/students/$studentId' params={{ studentId: child.name }}>
            <Card className='transition-colors hover:bg-muted/50'>
              <CardContent className='flex items-center justify-between py-4'>
                <div>
                  <p className='font-medium'>{formatStudentName(child.first_name, child.last_name)}</p>
                  <CardDescription>{child.name} · {child.grade ?? '—'} · {child.beneficiary_category}</CardDescription>
                </div>
                <div className='flex items-center gap-3'>
                  <Money usd={balanceUSD} compact />
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
