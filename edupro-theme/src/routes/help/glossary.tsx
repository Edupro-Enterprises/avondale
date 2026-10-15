import { createFileRoute } from '@tanstack/react-router'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import glossaryData from '@/content/knowledge-base/glossary.json'

export const Route = createFileRoute('/help/glossary')({
  component: KbGlossaryPage,
})

const terms = [...(glossaryData as { term: string; definition: string }[])].sort((a, b) =>
  a.term.localeCompare(b.term)
)

function KbGlossaryPage() {
  return (
    <>
      <KbHeader />
      <Main>
        <h1 className='mb-1 text-2xl font-bold tracking-tight'>Glossary</h1>
        <p className='mb-6 text-muted-foreground'>Financial-management terms used across the knowledge base.</p>

        <dl className='divide-y'>
          {terms.map((t) => (
            <div key={t.term} className='py-3'>
              <dt className='font-semibold'>{t.term}</dt>
              <dd className='mt-1 text-sm text-muted-foreground'>{t.definition}</dd>
            </div>
          ))}
        </dl>
      </Main>
    </>
  )
}
