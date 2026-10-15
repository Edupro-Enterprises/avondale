import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { BellRing, Building2, Contact as ContactIcon, DollarSign, FileText, MapPin, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { CompactField, compactControlClass } from '@/components/compact-field'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePageUnsavedGuard } from '@/hooks/use-page-unsaved-guard'
import { useSchoolBrandingStore } from '@/stores/school-branding-store'
import { useCurrentZigPerUsd, useSetTodayExchangeRate } from '@/lib/frappe/exchange-rates'
import { FrappeApiError, uploadFile } from '@/lib/frappe/client'
import { useDistricts, useRegions } from '@/lib/frappe/geography'
import { useSchoolSetup, useUpdateSchoolSetup, type FrappeSchoolSetup } from '@/lib/frappe/school-setup'
import { useCommunicationTemplates } from '@/lib/frappe/communication-templates'

export const Route = createFileRoute('/_authenticated/bursar/school-setup/institution-profile')({
  component: InstitutionProfilePage,
})

const legalEntityTypes: FrappeSchoolSetup['legal_entity_type'][] = ['Government', 'Council', 'Church', 'Private Trust']

type EditableFields = Pick<
  FrappeSchoolSetup,
  | 'school_name' | 'registration_number' | 'emis_number' | 'school_code' | 'school_logo'
  | 'physical_address' | 'postal_address' | 'telephone' | 'email' | 'contact_person'
  | 'district' | 'region' | 'legal_entity_type'
  | 'fund_a_name' | 'fund_b_name' | 'cash_up_variance_threshold' | 'sensitive_procurement_threshold'
  | 'primary_color' | 'secondary_color'
  | 'receipt_header' | 'receipt_footer' | 'statement_header' | 'statement_footer'
  | 'first_reminder_days' | 'second_reminder_days' | 'escalation_days'
  | 'first_reminder_template' | 'second_reminder_template'
>

const SECTION_ICONS: Record<string, React.ElementType> = {
  Identity: Building2,
  Location: MapPin,
  Contact: ContactIcon,
  'Financial Configuration': DollarSign,
  Branding: Palette,
  'Document Templates': FileText,
  'Debtor Management': BellRing,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const Icon = SECTION_ICONS[title]
  return (
    <Card>
      <CardHeader className='border-b py-3'>
        <CardTitle className='flex items-center gap-1.5 text-sm'>
          {Icon && <Icon className='h-3.5 w-3.5 text-primary' />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className='grid grid-cols-2 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-4'>{children}</CardContent>
    </Card>
  )
}

function extractEditable(schoolSetup: FrappeSchoolSetup): EditableFields {
  const { name: _n, banking_configuration: _b, procurement_quote_bands: _p, ...editable } = schoolSetup
  return editable
}

function InstitutionProfilePage() {
  const { data: schoolSetup, isLoading, error } = useSchoolSetup()

  if (isLoading) {
    return (
      <>
        <BursarHeader />
        <Main><p className='text-sm text-muted-foreground'>Loading…</p></Main>
      </>
    )
  }

  if (error || !schoolSetup) {
    return (
      <>
        <BursarHeader />
        <Main>
          <p className='text-sm text-destructive'>
            {error ? "Couldn't load the institution profile from the server." : 'No School Setup record exists yet -- ask a System Administrator to create one.'}
          </p>
        </Main>
      </>
    )
  }

  return <InstitutionProfileForm key={schoolSetup.name} schoolSetup={schoolSetup} />
}

function InstitutionProfileForm({ schoolSetup }: { schoolSetup: FrappeSchoolSetup }) {
  const { data: districts } = useDistricts()
  const { data: regions } = useRegions()
  const { data: templates } = useCommunicationTemplates()
  const updateSchoolSetup = useUpdateSchoolSetup()
  const setSchoolName = useSchoolBrandingStore((s) => s.setSchoolName)
  const { data: zigPerUsd = 27 } = useCurrentZigPerUsd()
  const setExchangeRate = useSetTodayExchangeRate()
  const [rateInput, setRateInput] = useState<string | null>(null)

  const [form, setForm] = useState<EditableFields>(() => extractEditable(schoolSetup))
  const [isDirty, setIsDirty] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const guard = usePageUnsavedGuard(isDirty)

  function set<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setIsDirty(true)
  }

  async function handleLogoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingLogo(true)
    try {
      const url = await uploadFile(file, { isPrivate: false })
      set('school_logo', url)
      toast.success('Logo uploaded -- save to apply')
    } catch {
      toast.error('Could not upload this logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave() {
    try {
      await updateSchoolSetup.mutateAsync({ name: schoolSetup.name, input: form })
      setSchoolName(form.school_name)
      setIsDirty(false)
      toast.success('Institution profile saved')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not save the institution profile.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <Building2 className='h-5 w-5' />
            </div>
            <div>
              <p className='mb-1 text-sm font-medium text-primary'>School Setup</p>
              <h1 className='text-3xl font-bold tracking-tight'>Institution Profile</h1>
              <p className='text-sm text-muted-foreground'>Core identity, contact, and financial configuration used across the system.</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={updateSchoolSetup.isPending}>{updateSchoolSetup.isPending ? 'Saving…' : 'Save changes'}</Button>
        </div>

        <div className='grid gap-4'>
          <Section title='Identity'>
            <CompactField label='School name' required>
              <Input className={compactControlClass} value={form.school_name} onChange={(e) => set('school_name', e.target.value)} />
            </CompactField>
            <CompactField label='School code' required>
              <Input className={compactControlClass} value={form.school_code} onChange={(e) => set('school_code', e.target.value)} />
            </CompactField>
            <CompactField label='Registration number' required>
              <Input className={compactControlClass} value={form.registration_number} onChange={(e) => set('registration_number', e.target.value)} />
            </CompactField>
            <CompactField label='EMIS number' required>
              <Input className={compactControlClass} value={form.emis_number} onChange={(e) => set('emis_number', e.target.value)} />
            </CompactField>
            <CompactField label='Legal entity type'>
              <Select value={form.legal_entity_type || undefined} onValueChange={(v) => set('legal_entity_type', v as EditableFields['legal_entity_type'])}>
                <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                <SelectContent>{legalEntityTypes.map((t) => t && <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </CompactField>
            <CompactField label='Logo' className='col-span-2'>
              <div className='flex items-center gap-2'>
                {form.school_logo && <img src={form.school_logo} alt='School logo' className='h-8 w-8 rounded object-contain' />}
                <input ref={logoInputRef} type='file' accept='image/*' className='hidden' onChange={handleLogoChosen} />
                <Button type='button' variant='outline' size='sm' onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                </Button>
              </div>
            </CompactField>
          </Section>

          <Section title='Location'>
            <CompactField label='Physical address' className='col-span-2' required>
              <Input className={compactControlClass} value={form.physical_address} onChange={(e) => set('physical_address', e.target.value)} />
            </CompactField>
            <CompactField label='Postal address' className='col-span-2'>
              <Input className={compactControlClass} value={form.postal_address ?? ''} onChange={(e) => set('postal_address', e.target.value)} />
            </CompactField>
            <CompactField label='District'>
              <Select value={form.district || undefined} onValueChange={(v) => set('district', v)}>
                <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                <SelectContent>{(districts ?? []).map((d) => <SelectItem key={d.name} value={d.name}>{d.district_name}</SelectItem>)}</SelectContent>
              </Select>
            </CompactField>
            <CompactField label='Region'>
              <Select value={form.region || undefined} onValueChange={(v) => set('region', v)}>
                <SelectTrigger className={compactControlClass}><SelectValue placeholder='Select…' /></SelectTrigger>
                <SelectContent>{(regions ?? []).map((r) => <SelectItem key={r.name} value={r.name}>{r.region_name}</SelectItem>)}</SelectContent>
              </Select>
            </CompactField>
          </Section>

          <Section title='Contact'>
            <CompactField label='Telephone'>
              <Input className={compactControlClass} value={form.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} />
            </CompactField>
            <CompactField label='Email'>
              <Input type='email' className={compactControlClass} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </CompactField>
            <CompactField label='Contact person'>
              <Input className={compactControlClass} value={form.contact_person ?? ''} onChange={(e) => set('contact_person', e.target.value)} />
            </CompactField>
          </Section>

          <Section title='Financial Configuration'>
            <CompactField label='Primary currency (shown to users)'>
              <Select value='USD' disabled>
                <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value='USD'>USD</SelectItem></SelectContent>
              </Select>
            </CompactField>
            <CompactField label='Exchange rate (ZiG per USD)'>
              <div className='flex items-center gap-2'>
                <Input
                  type='number'
                  className={compactControlClass}
                  value={rateInput ?? zigPerUsd}
                  onChange={(e) => setRateInput(e.target.value)}
                />
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={setExchangeRate.isPending || rateInput === null || Number(rateInput) === zigPerUsd}
                  onClick={async () => {
                    try {
                      await setExchangeRate.mutateAsync(Number(rateInput))
                      setRateInput(null)
                      toast.success('Exchange rate updated')
                    } catch (err) {
                      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not update the exchange rate.')
                    }
                  }}
                >
                  Update
                </Button>
              </div>
            </CompactField>
            <CompactField label='Fund A name'>
              <Input className={compactControlClass} value={form.fund_a_name ?? ''} onChange={(e) => set('fund_a_name', e.target.value)} />
            </CompactField>
            <CompactField label='Fund B name'>
              <Input className={compactControlClass} value={form.fund_b_name ?? ''} onChange={(e) => set('fund_b_name', e.target.value)} />
            </CompactField>
            <CompactField label='Daily cash-up variance threshold'>
              <Input type='number' min='0' step='0.01' className={compactControlClass} value={form.cash_up_variance_threshold ?? ''} onChange={(e) => set('cash_up_variance_threshold', Number(e.target.value) || 0)} />
            </CompactField>
            <CompactField label='Sensitive procurement threshold'>
              <Input type='number' min='0' step='0.01' className={compactControlClass} value={form.sensitive_procurement_threshold ?? ''} onChange={(e) => set('sensitive_procurement_threshold', Number(e.target.value) || 0)} />
            </CompactField>
          </Section>

          <Section title='Branding'>
            <CompactField label='Primary color'>
              <Input type='color' className={`${compactControlClass} h-9 p-1`} value={form.primary_color || '#000000'} onChange={(e) => set('primary_color', e.target.value)} />
            </CompactField>
            <CompactField label='Secondary color'>
              <Input type='color' className={`${compactControlClass} h-9 p-1`} value={form.secondary_color || '#000000'} onChange={(e) => set('secondary_color', e.target.value)} />
            </CompactField>
          </Section>

          <Section title='Document Templates'>
            <CompactField label='Receipt header text' className='col-span-2'>
              <Textarea className='text-sm' rows={2} value={form.receipt_header ?? ''} onChange={(e) => set('receipt_header', e.target.value)} />
            </CompactField>
            <CompactField label='Receipt footer text' className='col-span-2'>
              <Textarea className='text-sm' rows={2} value={form.receipt_footer ?? ''} onChange={(e) => set('receipt_footer', e.target.value)} />
            </CompactField>
            <CompactField label='Statement header text' className='col-span-2'>
              <Textarea className='text-sm' rows={2} value={form.statement_header ?? ''} onChange={(e) => set('statement_header', e.target.value)} />
            </CompactField>
            <CompactField label='Statement footer text' className='col-span-2'>
              <Textarea className='text-sm' rows={2} value={form.statement_footer ?? ''} onChange={(e) => set('statement_footer', e.target.value)} />
            </CompactField>
          </Section>

          <Section title='Debtor Management'>
            <CompactField label='First reminder (days overdue)'>
              <Input type='number' min='0' className={compactControlClass} value={form.first_reminder_days ?? ''} onChange={(e) => set('first_reminder_days', Number(e.target.value) || 0)} />
            </CompactField>
            <CompactField label='Second reminder (days overdue)'>
              <Input type='number' min='0' className={compactControlClass} value={form.second_reminder_days ?? ''} onChange={(e) => set('second_reminder_days', Number(e.target.value) || 0)} />
            </CompactField>
            <CompactField label='Escalate after (days overdue)'>
              <Input type='number' min='0' className={compactControlClass} value={form.escalation_days ?? ''} onChange={(e) => set('escalation_days', Number(e.target.value) || 0)} />
            </CompactField>
            <CompactField label='First reminder template'>
              <Select value={form.first_reminder_template || '__default__'} onValueChange={(v) => set('first_reminder_template', v === '__default__' ? undefined : v)}>
                <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__default__'>Default wording</SelectItem>
                  {(templates ?? []).map((t) => <SelectItem key={t.name} value={t.name}>{t.template_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CompactField>
            <CompactField label='Second reminder template'>
              <Select value={form.second_reminder_template || '__default__'} onValueChange={(v) => set('second_reminder_template', v === '__default__' ? undefined : v)}>
                <SelectTrigger className={compactControlClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__default__'>Default wording</SelectItem>
                  {(templates ?? []).map((t) => <SelectItem key={t.name} value={t.name}>{t.template_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CompactField>
          </Section>

          <p className='text-xs text-muted-foreground'>
            Banking configuration and procurement quote bands are managed on their own pages (School Setup → Bank Accounts).
          </p>
        </div>

        <ConfirmDialog {...guard.discardDialogProps} />
      </Main>
    </>
  )
}
