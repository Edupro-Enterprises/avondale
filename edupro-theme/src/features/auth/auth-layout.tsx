import { useSchoolBranding } from '@/lib/frappe/school-setup'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { data: branding } = useSchoolBranding()
  const logoUrl = branding?.school_logo || '/brand/edupro-logo.png'
  const schoolName = branding?.school_name || 'Edupro SMS'

  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8'>
        <div className='mb-4 flex flex-col items-center justify-center gap-1'>
          <img src={logoUrl} alt={schoolName} className='h-12 w-auto' />
          <p className='text-sm font-medium'>{schoolName}</p>
          <p className='text-xs text-muted-foreground'>powered by Edupro</p>
        </div>
        {children}
      </div>
    </div>
  )
}
