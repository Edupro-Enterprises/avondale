import { Callout } from './callout'
import { Steps, Step } from './steps'
import { Checklist, ChecklistItem } from './checklist'
import { Faq, FaqItem } from './faq'
import { LegalCitation } from './legal-citation'
import { Definition } from './definition'
import { Figure } from './figure'
import { DataTable } from './data-table'
import { RoleNote } from './role-note'
import { Example } from './example'

/** Passed as MDX's `components` prop (see kb-article-template.tsx) so
 * every article can use these 13 tags without an explicit per-file
 * import. Content authors only ever write JSX tags in MDX; wiring stays
 * here, one place. */
export const kbMdxComponents = {
  Callout,
  Steps,
  Step,
  Checklist,
  ChecklistItem,
  Faq,
  FaqItem,
  LegalCitation,
  Definition,
  Figure,
  DataTable,
  RoleNote,
  Example,
}
