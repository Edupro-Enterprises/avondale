import { useRef, useState } from 'react'
import { z } from 'zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSchoolBrandingStore } from '@/stores/school-branding-store'

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2MB -- this is stored in localStorage, keep it modest

function SchoolLogoUpload() {
  const logoUrl = useSchoolBrandingStore((s) => s.logoUrl)
  const isCustomLogo = useSchoolBrandingStore((s) => s.isCustomLogo)
  const setLogo = useSchoolBrandingStore((s) => s.setLogo)
  const resetLogo = useSchoolBrandingStore((s) => s.resetLogo)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isReading, setIsReading] = useState(false)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, or SVG).')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be under 2MB. Try a smaller or more compressed image.')
      return
    }

    setIsReading(true)
    const reader = new FileReader()
    reader.onload = () => {
      setLogo(reader.result as string)
      setIsReading(false)
      toast.success('School logo updated — it now appears everywhere across the system.')
    }
    reader.onerror = () => {
      setIsReading(false)
      toast.error('Could not read that file. Please try again.')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className='space-y-2'>
      <Label>School logo</Label>
      <div className='flex items-center gap-4'>
        <div className='flex h-16 w-16 items-center justify-center rounded-lg border bg-muted/40 p-2'>
          <img src={logoUrl} alt='School logo' className='max-h-full max-w-full object-contain' />
        </div>
        <div className='flex flex-col gap-2'>
          <div className='flex gap-2'>
            <Button type='button' variant='outline' size='sm' disabled={isReading} onClick={() => fileInputRef.current?.click()}>
              <Upload className='h-4 w-4' />
              {isReading ? 'Uploading…' : 'Upload logo'}
            </Button>
            {isCustomLogo && (
              <Button type='button' variant='ghost' size='sm' onClick={() => { resetLogo(); toast.info('Reverted to the default logo') }}>
                <X className='h-4 w-4' />
                Remove
              </Button>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>PNG, JPG, or SVG, up to 2MB. Appears on receipts, statements, the sidebar, and every login screen.</p>
        </div>
      </div>
      <input ref={fileInputRef} type='file' accept='image/*' className='hidden' onChange={handleFileSelect} />
    </div>
  )
}

const profileFormSchema = z.object({
  username: z
    .string('Please enter your school name.')
    .min(2, 'School name must be at least 2 characters.')
    .max(60, 'School name must not be longer than 60 characters.'),
  email: z.email({
    error: (iss) =>
      iss.input === undefined
        ? 'Please select an email to display.'
        : undefined,
  }),
  bio: z.string().max(200).min(4),
  urls: z
    .array(
      z.object({
        value: z.url('Please enter a valid URL.'),
      })
    )
    .optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

// This can come from your database or API.
const defaultValues: Partial<ProfileFormValues> = {
  username: 'Avondale Primary School',
  bio: 'A government-aided secondary school in Harare Metropolitan (EMIS 1234567890), Forms 1 through 6.',
  urls: [
    { value: 'https://mbarehigh.edu.zw' },
  ],
}

export function ProfileForm() {
  const setSchoolName = useSchoolBrandingStore((s) => s.setSchoolName)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  const { fields, append } = useFieldArray({
    name: 'urls',
    control: form.control,
  })

  function onSubmit(data: ProfileFormValues) {
    setSchoolName(data.username)
    showSubmittedData(data)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='space-y-8'
      >
        <SchoolLogoUpload />

        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>School name</FormLabel>
              <FormControl>
                <Input placeholder='Edupro School' {...field} />
              </FormControl>
              <FormDescription>
                This is the name shown on the parent portal, receipts, and
                statements. You can only change this once every 30 days.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Finance office email</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select a verified email to display' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='bursar@mbarehigh.edu.zw'>bursar@mbarehigh.edu.zw</SelectItem>
                  <SelectItem value='accounts@mbarehigh.edu.zw'>accounts@mbarehigh.edu.zw</SelectItem>
                  <SelectItem value='admissions@mbarehigh.edu.zw'>admissions@mbarehigh.edu.zw</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Parents and staff will see this address on invoices and
                automated reminders.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='bio'
          render={({ field }) => (
            <FormItem>
              <FormLabel>About the school</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Tell parents a little about your school'
                  className='resize-none'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Shown on the parent portal welcome screen and admissions
                pages.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`urls.${index}.value`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(index !== 0 && 'sr-only')}>
                    Website & social links
                  </FormLabel>
                  <FormDescription className={cn(index !== 0 && 'sr-only')}>
                    Add links to your school website, social media, or
                    enrollment portal.
                  </FormDescription>
                  <FormControl className={cn(index !== 0 && 'mt-1.5')}>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='mt-2'
            onClick={() => append({ value: '' })}
          >
            Add link
          </Button>
        </div>
        <Button type='submit'>Update school profile</Button>
      </form>
    </Form>
  )
}
