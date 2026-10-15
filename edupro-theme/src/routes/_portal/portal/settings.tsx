import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useMyGuardian } from '@/lib/frappe/students'

export const Route = createFileRoute('/_portal/portal/settings')({
  component: AccountSettingsPage,
})

function AccountSettingsPage() {
  const { data: guardian } = useMyGuardian()

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Account Settings</h1>
        <p className='text-sm text-muted-foreground'>Read-only — contact your Bursar's office to update these details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>Used for statements, receipts, and reminders.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-2'>
            <Label>Full name</Label>
            <Input value={guardian?.full_name ?? ''} disabled />
          </div>
          <div className='grid gap-2'>
            <Label>Relationship</Label>
            <Input value={guardian?.relationship ?? ''} disabled />
          </div>
          <div className='grid gap-2'>
            <Label>Email</Label>
            <Input value={guardian?.email ?? ''} disabled />
          </div>
          <div className='grid gap-2'>
            <Label>Phone</Label>
            <Input value={guardian?.phone_number ?? ''} disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
