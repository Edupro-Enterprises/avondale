import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export interface PortalNavLink {
  title: string
  to: string
  icon: React.ElementType
}

/** A lightweight portal's entire navigation -- a handful of shallow, flat
 * links, no nested tree. Shared by Parent and Student, each passing their
 * own link set, since the two audiences see very different things. */
export function PortalNav({ links }: { links: PortalNavLink[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className='sticky top-14 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60'>
      <div className='mx-auto flex max-w-2xl items-center gap-1 overflow-x-auto px-4'>
        {links.map((link) => {
          const isActive = link.to === links[0].to ? pathname === link.to : pathname.startsWith(link.to)
          const Icon = link.icon
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className='h-4 w-4' />
              {link.title}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
