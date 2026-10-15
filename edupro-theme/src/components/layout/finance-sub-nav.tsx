import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

interface FinanceSubNavLink {
  title: string
  href: string
}

interface FinanceSubNavProps {
  links: FinanceSubNavLink[]
  activeHref: string
  className?: string
}

export function FinanceSubNav({ links, activeHref, className }: FinanceSubNavProps) {
  return (
    <div className={cn('mb-6 flex items-center gap-1 overflow-x-auto border-b', className)}>
      {links.map((link) => (
        <Link
          key={link.href}
          to={link.href}
          className={cn(
            'shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            link.href === activeHref
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {link.title}
        </Link>
      ))}
    </div>
  )
}
