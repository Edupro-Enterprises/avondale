import { Fragment } from 'react'
import { useRouterState } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { type SidebarData } from '@/components/layout/types'

interface PageBreadcrumbProps {
  sidebarData?: SidebarData
}

/** Derives "Group / Item / Sub-item" from the active role's own nav data,
 * so restructuring the sidebar (AUD-015) never leaves the trail stale. Detail
 * routes with dynamic segments won't match anything here and render nothing --
 * they get their own BackLink instead (AUD-017). */
export function PageBreadcrumb({ sidebarData }: PageBreadcrumbProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (!sidebarData) return null

  const homeUrl = sidebarData.navGroups[0]?.items[0]?.url

  for (const group of sidebarData.navGroups) {
    for (const item of group.items) {
      if (item.url && item.url === pathname) {
        if (item.url === homeUrl) return null
        return <Trail crumbs={[group.title, item.title]} />
      }
      if (item.items) {
        for (const subItem of item.items) {
          if (subItem.url === pathname) {
            return <Trail crumbs={[group.title, item.title, subItem.title]} />
          }
        }
      }
    }
  }
  return null
}

function Trail({ crumbs }: { crumbs: string[] }) {
  const last = crumbs[crumbs.length - 1]
  const parents = crumbs.slice(0, -1)

  return (
    <Breadcrumb className='mb-4'>
      <BreadcrumbList>
        {parents.map((crumb) => (
          <Fragment key={crumb}>
            <BreadcrumbItem>{crumb}</BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage>{last}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
