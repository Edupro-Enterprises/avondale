import { createContext, useContext, useEffect, useState } from 'react'
import { CommandMenu } from '@/components/command-menu'
import { type SidebarData } from '@/components/layout/types'

type SearchContextType = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  sidebarData?: SidebarData
}

const SearchContext = createContext<SearchContextType | null>(null)

type SearchProviderProps = {
  children: React.ReactNode
  /** The active role's own nav, so ⌘K shows the menu for whichever shell
   * is actually mounted instead of always defaulting to the Bursar's. */
  sidebarData?: SidebarData
}

export function SearchProvider({ children, sidebarData }: SearchProviderProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <SearchContext value={{ open, setOpen, sidebarData }}>
      {children}
      <CommandMenu sidebarData={sidebarData} />
    </SearchContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSearch = () => {
  const searchContext = useContext(SearchContext)

  if (!searchContext) {
    throw new Error('useSearch has to be used within SearchProvider')
  }

  return searchContext
}
