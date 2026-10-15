import { Scale } from 'lucide-react'
import type { KbLegalInstrument } from '@/features/knowledge-base/types/kb'

/** Inline citation for a specific clause within one of the KB's controlled
 * legal instruments (see KB_LEGAL_INSTRUMENTS) -- the article-level
 * `legal_references` footer (kb-article-template.tsx) lists the whole
 * instrument; this cites the specific section a claim in the body rests on. */
export function LegalCitation({ instrument, section }: { instrument: KbLegalInstrument; section?: string }) {
  return (
    <span className='inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 align-middle text-xs font-medium text-muted-foreground'>
      <Scale className='size-3' />
      {instrument}
      {section && <span className='text-muted-foreground/70'>{section}</span>}
    </span>
  )
}
