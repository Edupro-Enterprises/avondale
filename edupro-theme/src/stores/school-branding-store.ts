import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_LOGO_URL = '/brand/edupro-logo.png'
const DEFAULT_SCHOOL_NAME = 'Avondale Primary School'

interface SchoolBrandingState {
  logoUrl: string
  schoolName: string
  isCustomLogo: boolean
  setLogo: (dataUrl: string) => void
  setSchoolName: (name: string) => void
  resetLogo: () => void
}

/** The single source of truth for the school's logo + name, shown in every
 * header/sidebar across all five role shells. Backed by localStorage since
 * this theme has no backend yet -- once wired to the real system, this
 * becomes a read from School Setup instead of local persistence. */
export const useSchoolBrandingStore = create<SchoolBrandingState>()(
  persist(
    (set) => ({
      logoUrl: DEFAULT_LOGO_URL,
      schoolName: DEFAULT_SCHOOL_NAME,
      isCustomLogo: false,
      setLogo: (dataUrl) => set({ logoUrl: dataUrl, isCustomLogo: true }),
      setSchoolName: (name) => set({ schoolName: name }),
      resetLogo: () => set({ logoUrl: DEFAULT_LOGO_URL, isCustomLogo: false }),
    }),
    { name: 'edupro-school-branding' }
  )
)
