import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FinanceSubNav } from '@/components/layout/finance-sub-nav'
import { Money } from '@/components/money'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { ReportActions } from '@/components/report-actions'
import { reportsNavLinks } from '@/features/bursar-reports/reports-nav'
import { useFixedAssetsDisposalRegister, type FixedAssetsDisposalRow } from '@/lib/frappe/reports'

export const Route = createFileRoute('/_authenticated/bursar/reports/fixed-assets-register')({
  component: FixedAssetsRegisterReportPage,
})

const statusTone: Record<string, StatusTone> = { 'In Use': 'good', Disposed: 'neutral' }

function amount(row: FixedAssetsDisposalRow, value: number) {
  return row.currency === 'ZiG' ? <span>{value.toFixed(2)} ZiG</span> : <Money usd={value} />
}

function FixedAssetsRegisterReportPage() {
  const { data, isLoading, error } = useFixedAssetsDisposalRegister()
  const reportRows = useMemo(
    () =>
      (data?.assets ?? []).map((a) => [
        a.asset_code,
        a.description,
        a.date_acquired,
        `${a.historical_cost.toFixed(2)} ${a.currency}`,
        `${a.accumulated_depreciation.toFixed(2)} ${a.currency}`,
        `${a.net_book_value.toFixed(2)} ${a.currency}`,
        a.disposal_status,
      ]),
    [data]
  )

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Reports</p>
            <h1 className='text-3xl font-bold tracking-tight'>Fixed Assets Register</h1>
            <p className='text-sm text-muted-foreground'>Statutory register -- see Finance → Fixed Assets to add or dispose an asset.</p>
          </div>
          <ReportActions
            filename='fixed-assets-register'
            title='Fixed Assets Register'
            meta={`Generated ${new Date().toISOString().slice(0, 10)} · statutory register`}
            header={['Asset Code', 'Description', 'Date Acquired', 'Historical Cost', 'Accum. Depreciation', 'Net Book Value', 'Status']}
            rows={reportRows}
            reportKey='fixed-assets-register'
          />
        </div>
        <FinanceSubNav links={reportsNavLinks} activeHref='/bursar/reports/fixed-assets-register' />

        {error && (
          <Card className='mb-4 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load the asset register from the server. Try refreshing the page.</CardContent></Card>
        )}
        {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}

        {data && (
          <>
            <div className='mb-4 grid gap-4 sm:grid-cols-3'>
              <Card>
                <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
                <CardContent className='text-2xl font-bold'>{data.total_assets} <span className='text-sm font-normal text-muted-foreground'>({data.total_in_use} in use, {data.total_disposed} disposed)</span></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Total historical cost</CardTitle></CardHeader>
                <CardContent className='text-2xl font-bold tabular-nums'>{data.total_historical_cost.toFixed(2)}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Net book value</CardTitle></CardHeader>
                <CardContent className='text-2xl font-bold tabular-nums'>{data.total_net_book_value.toFixed(2)}</CardContent>
              </Card>
            </div>
            <p className='mb-4 text-xs text-muted-foreground'>Totals above are simple sums across all assets regardless of currency -- treat as directional only; see each asset's own figure for its real currency.</p>

            <Card>
              <CardHeader className='border-b'>
                <CardTitle>Register</CardTitle>
                <CardDescription>{data.assets.length} assets · accumulated depreciation {data.total_accumulated_depreciation.toFixed(2)} (mixed currencies)</CardDescription>
              </CardHeader>
              <CardContent className='pt-0'>
                <div className='divide-y'>
                  {data.assets.map((a) => (
                    <div key={a.asset_code} className='flex items-center justify-between gap-4 py-3'>
                      <div>
                        <p className='text-sm font-medium'>{a.description}</p>
                        <p className='text-xs text-muted-foreground'>
                          {a.asset_code} · acquired {a.date_acquired} · cost {amount(a, a.historical_cost)} · accum. dep. {amount(a, a.accumulated_depreciation)}
                        </p>
                      </div>
                      <div className='flex items-center gap-3'>
                        {amount(a, a.net_book_value)}
                        <StatusBadge tone={statusTone[a.disposal_status] ?? 'neutral'}>{a.disposal_status}</StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {data.disposals.length > 0 && (
              <Card className='mt-4'>
                <CardHeader className='border-b'><CardTitle>Disposals</CardTitle><CardDescription>{data.disposals.length} assets disposed</CardDescription></CardHeader>
                <CardContent className='pt-0'>
                  <div className='divide-y'>
                    {data.disposals.map((a) => (
                      <div key={a.asset_code} className='flex items-center justify-between gap-4 py-3'>
                        <div>
                          <p className='text-sm font-medium'>{a.description}</p>
                          <p className='text-xs text-muted-foreground'>
                            {a.asset_code} · disposed {a.disposal_date}{a.disposal_praz_reference ? ` · PRAZ ${a.disposal_praz_reference}` : ''}
                          </p>
                        </div>
                        {amount(a, a.net_book_value)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Main>
    </>
  )
}
