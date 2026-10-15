import { Link } from '@tanstack/react-router'
import { useSchoolBranding } from '@/lib/frappe/school-setup'

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
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
            Back to sign in
          </Link>
        </div>
      </header>
      <main className='mx-auto max-w-3xl px-4 py-10'>
        <h1 className='mb-1 text-2xl font-bold tracking-tight'>{title}</h1>
        <p className='mb-8 text-sm text-muted-foreground'>Last updated {updated}</p>
        <div className='space-y-6 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1'>
          {children}
        </div>
      </main>
    </div>
  )
}
