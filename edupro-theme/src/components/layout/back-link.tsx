import { Link, type LinkProps } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

interface BackLinkProps {
  to: LinkProps['to']
  label: string
}

/** Shared back-navigation affordance for detail routes (AUD-017). */
export function BackLink({ to, label }: BackLinkProps) {
  return (
    <Link
      to={to}
      className='mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
    >
      <ArrowLeft className='h-4 w-4' />
      {label}
    </Link>
  )
}
