import { type ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  type NavCollapsible,
  type NavItem,
  type NavLink,
  type NavGroup as NavGroupProps,
} from './types'

interface NavGroupComponentProps extends NavGroupProps {
  /** Whether this group's own big-icon dropdown is open -- only meaningful
   * (and only rendered) when the group sets `icon`; groups without one keep
   * the old always-expanded plain-label rendering unchanged, so other
   * roles' sidebars (which don't set group icons) are unaffected. */
  isOpen?: boolean
  onToggle?: () => void
}

function GroupItems({ items, href }: { items: NavItem[]; href: string }) {
  const { state, isMobile } = useSidebar()
  return (
    <SidebarMenu>
      {items.map((item) => {
        const key = `${item.title}-${item.url}`

        if (!item.items)
          return <SidebarMenuLink key={key} item={item} href={href} />

        if (state === 'collapsed' && !isMobile)
          return (
            <SidebarMenuCollapsedDropdown key={key} item={item} href={href} />
          )

        return <SidebarMenuCollapsible key={key} item={item} href={href} />
      })}
    </SidebarMenu>
  )
}

export function NavGroup({ title, items, icon, color, isOpen, onToggle }: NavGroupComponentProps) {
  const { state, isMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })
  const collapsedRail = state === 'collapsed' && !isMobile

  // Old, always-expanded rendering for any sidebar that doesn't opt into a
  // big-icon group header (no `icon` set), and for the collapsed icon rail
  // (its own flyout-per-item behavior already handles "minimal").
  if (!icon || collapsedRail) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{title}</SidebarGroupLabel>
        <GroupItems items={items} href={href} />
      </SidebarGroup>
    )
  }

  // A single, plain page (e.g. Dashboard) -- just a bigger-icon link, no
  // dropdown to open since there's nothing to reveal.
  if (items.length === 1 && !items[0].items) {
    const item = items[0] as NavLink
    return (
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuLink item={item} href={href} bigIcon={icon} bigColor={color} />
        </SidebarMenu>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <Collapsible open={isOpen} onOpenChange={onToggle} className='group/group-collapsible'>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton size='lg' isActive={!isOpen && checkGroupHasActiveHref(items, href)}>
            <GroupIcon icon={icon} color={color} />
            <span className='text-sm font-semibold'>{title}</span>
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/group-collapsible:rotate-90 rtl:rotate-180' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <GroupItems items={items} href={href} />
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}

function GroupIcon({ icon: Icon, color }: { icon: React.ElementType; color?: string }) {
  return <Icon className={`size-5! ${color ?? ''}`} />
}

/** Exact-match only (no mainNav fuzzy fallback): every route in this app is
 * nested under /bursar/..., so the first path segment is always "bursar"
 * for every item -- the fuzzy same-first-segment check checkIsActive uses
 * elsewhere would (and did) match every single group at once. */
function checkGroupHasActiveHref(items: NavItem[], href: string) {
  const path = href.split('?')[0]
  return items.some((item) => item.url === path || item.items?.some((sub) => sub.url === path))
}

/** Which top-level group (if any) contains the current route -- used by
 * AppSidebar to default that one group open on load, instead of landing on
 * a fully-collapsed menu after navigating somewhere. */
export function findActiveGroupTitle(groups: NavGroupProps[], href: string) {
  return groups.find((g) => checkGroupHasActiveHref(g.items, href))?.title ?? null
}

function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='rounded-full px-1 py-0 text-xs'>{children}</Badge>
}

function SidebarMenuLink({
  item,
  href,
  bigIcon: BigIcon,
  bigColor,
}: {
  item: NavLink
  href: string
  /** Renders this link's icon bigger (a lone group like Dashboard, styled
   * to match the other groups' big-icon headers) instead of its normal
   * small icon. */
  bigIcon?: React.ElementType
  bigColor?: string
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        size={BigIcon ? 'lg' : 'default'}
        isActive={checkIsActive(href, item)}
        tooltip={item.title}
      >
        <Link to={item.url} onClick={() => setOpenMobile(false)}>
          {BigIcon ? <BigIcon className={`size-5! ${bigColor ?? ''}`} /> : item.icon && <item.icon className={item.color} />}
          <span className={BigIcon ? 'text-sm font-semibold' : undefined}>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarMenuCollapsible({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <Collapsible
      asChild
      defaultOpen={checkIsActive(href, item, true)}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon className={item.color} />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {item.items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  asChild
                  isActive={checkIsActive(href, subItem)}
                >
                  <Link to={subItem.url} onClick={() => setOpenMobile(false)}>
                    {subItem.icon && <subItem.icon className={subItem.color} />}
                    <span>{subItem.title}</span>
                    {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function SidebarMenuCollapsedDropdown({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={checkIsActive(href, item)}
          >
            {item.icon && <item.icon className={item.color} />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuLabel>
            {item.title} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => (
            <DropdownMenuItem key={`${sub.title}-${sub.url}`} asChild>
              <Link
                to={sub.url}
                className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
              >
                {sub.icon && <sub.icon className={sub.color} />}
                <span className='max-w-52 text-wrap'>{sub.title}</span>
                {sub.badge && (
                  <span className='ms-auto text-xs'>{sub.badge}</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function checkIsActive(href: string, item: NavItem, mainNav = false) {
  return (
    href === item.url || // /endpint?search=param
    href.split('?')[0] === item.url || // endpoint
    !!item?.items?.filter((i) => i.url === href).length || // if child nav is active
    (mainNav &&
      href.split('/')[1] !== '' &&
      href.split('/')[1] === item?.url?.split('/')[1])
  )
}
