import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Contact, FileBarChart2, Layers, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'

export const Route = createFileRoute('/_authenticated/bursar/settings/import-export')({
  component: ImportExportPage,
})

const IMPORTS = [
  { title: 'Students', description: 'Bulk-add students from a spreadsheet template.', url: '/bursar/students', icon: Users },
  { title: 'Guardians', description: 'Bulk-add guardians and link them to students.', url: '/bursar/guardians', icon: Contact },
  { title: 'Class Streams', description: 'Bulk-enroll students into classes/streams.', url: '/bursar/school-setup/class-streams', icon: Layers },
] as const

const EXPORTS = [
  { title: 'Reports', description: 'Every report page offers CSV, Excel, JSON and PDF export via its own View/Export buttons.', url: '/bursar/reports/receipts-payments' },
  { title: 'Invoices & receipts', description: 'View or download any invoice/receipt as a PDF from Billing and the Payment Desk.', url: '/bursar/billing/invoices' },
  { title: 'Student statements', description: 'View or download a student statement (with banking details) from their profile.', url: '/bursar/students' },
] as const

function ImportExportPage() {
  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6'>
          <p className='mb-1 text-sm font-medium text-primary'>Settings</p>
          <h1 className='text-3xl font-bold tracking-tight'>Import & Export</h1>
          <p className='text-sm text-muted-foreground'>Every place data can be bulk-imported or exported, in one place.</p>
        </div>

        <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Import</h2>
        <div className='mb-8 grid gap-4 sm:grid-cols-3'>
          {IMPORTS.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <item.icon className='h-5 w-5 text-primary' />
                <CardTitle className='text-base'>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant='outline' size='sm' asChild>
                  <Link to={item.url}>Open<ArrowRight className='h-3.5 w-3.5' /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className='mb-3 text-sm font-semibold text-muted-foreground'>Export</h2>
        <div className='grid gap-4 sm:grid-cols-3'>
          {EXPORTS.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <FileBarChart2 className='h-5 w-5 text-primary' />
                <CardTitle className='text-base'>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant='outline' size='sm' asChild>
                  <Link to={item.url}>Open<ArrowRight className='h-3.5 w-3.5' /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </Main>
    </>
  )
}
