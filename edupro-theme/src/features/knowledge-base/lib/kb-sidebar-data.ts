import { BookOpen, Compass, FileText, HelpCircle, Library, Hash, Star } from 'lucide-react'
import type { SidebarData, NavGroup } from '@/components/layout/types'
import { getSections } from '@/features/knowledge-base/lib/content-loader'

const EXPLORE_GROUP: NavGroup = {
  title: 'Explore',
  icon: Compass,
  items: [
    { title: 'My Library', icon: Star, url: '/help/library' },
    { title: 'Templates', icon: FileText, url: '/help/templates' },
    { title: 'FAQ', icon: HelpCircle, url: '/help/faq' },
    { title: 'Glossary', icon: Library, url: '/help/glossary' },
    { title: 'Acronyms', icon: Hash, url: '/help/acronyms' },
  ],
}

/** Converts the content tree into the same SidebarData shape every role
 * shell already uses (section -> group, chapter -> collapsible item,
 * article -> sub-item) so the KB gets AppSidebar/PageBreadcrumb/Search
 * for free instead of a parallel nav implementation. Draft articles are
 * left out of navigation; content-loader.ts still resolves them by direct
 * URL for authors previewing unpublished work. Sections/chapters that end
 * up with zero published articles are dropped rather than shown empty. */
function buildKbSidebarData(): SidebarData {
  const navGroups: NavGroup[] = getSections()
    .map((section) => ({
      title: section.meta.title,
      icon: BookOpen,
      items: section.chapters
        .map((chapter) => {
          const articles = chapter.articles.filter((a) => !a.frontmatter.draft)
          if (articles.length === 0) return null
          return {
            title: chapter.meta.title,
            items: articles.map((article) => ({
              title: article.frontmatter.title,
              url: `/help/${section.id}/${chapter.id}/${article.frontmatter.slug}` as const,
            })),
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    }))
    .filter((group) => group.items.length > 0)

  return {
    teams: [{ name: 'Knowledge Base', logo: BookOpen, plan: 'Help Centre' }],
    navGroups: [EXPLORE_GROUP, ...navGroups],
  }
}

/** Computed once, not per-render -- the content tree is static for the
 * session (see content-loader.ts's own cache), and CommandMenu needs a
 * stable reference to tell "this is the KB's sidebar" apart from a role's,
 * the same way it already does for bursarSidebarData. */
export const kbSidebarData: SidebarData = buildKbSidebarData()
