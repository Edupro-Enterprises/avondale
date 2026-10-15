import { createFileRoute } from '@tanstack/react-router'
import { KbHeader } from '@/components/layout/kb-header'
import { Main } from '@/components/layout/main'
import acronymsData from '@/content/knowledge-base/acronyms.json'

export const Route = createFileRoute('/help/acronyms')({
  component: KbAcronymsPage,
})

const acronyms = [...(acronymsData as { acronym: string; expansion: string }[])].sort((a, b) =>
  a.acronym.localeCompare(b.acronym)
)

function KbAcronymsPage() {
  return (
    <>
      <KbHeader />
      <Main>
        <h1 className='mb-1 text-2xl font-bold tracking-tight'>Acronyms</h1>
        <p className='mb-6 text-muted-foreground'>Common abbreviations used across the knowledge base.</p>

        <dl className='divide-y'>
          {acronyms.map((a) => (
            <div key={a.acronym} className='flex items-baseline gap-3 py-3'>
              <dt className='w-24 shrink-0 font-semibold'>{a.acronym}</dt>
              <dd className='text-sm text-muted-foreground'>{a.expansion}</dd>
            </div>
          ))}
        </dl>
      </Main>
    </>
  )
}
