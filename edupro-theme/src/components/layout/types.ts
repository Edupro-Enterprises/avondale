import { type LinkProps } from '@tanstack/react-router'

type Team = {
  name: string
  logo: React.ElementType
  plan: string
}

type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  /** Tailwind text-color classes for this item's icon (e.g. 'text-violet-600
   * dark:text-violet-400') -- optional so other roles' sidebars, which don't
   * set it, render exactly as before. */
  color?: string
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: string
  items: NavItem[]
  /** Rendered bigger, on the group's own big-icon dropdown header (see
   * nav-group.tsx) -- distinct from each item's own smaller icon below it. */
  icon?: React.ElementType
  color?: string
}

type SidebarData = {
  teams: Team[]
  navGroups: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavLink }
