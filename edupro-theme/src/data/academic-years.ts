export type AcademicYearStatus = 'Draft' | 'Active' | 'Closed'

export interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  status: AcademicYearStatus
  isCurrent: boolean
  closedDate: string
  closedBy: string
}

export const mockAcademicYears: AcademicYear[] = [
  {
    id: 'AY-2025',
    name: '2025',
    startDate: '2025-01-13',
    endDate: '2025-12-05',
    status: 'Closed',
    isCurrent: false,
    closedDate: '2025-12-19',
    closedBy: 'Tendai Marufu',
  },
  {
    id: 'AY-2026',
    name: '2026',
    startDate: '2026-01-12',
    endDate: '2026-12-04',
    status: 'Active',
    isCurrent: true,
    closedDate: '',
    closedBy: '',
  },
]

/** For O(1) lookups in list rows instead of a `.find()` per row (AUD-056). */
export const academicYearsById = new Map(mockAcademicYears.map((y) => [y.id, y]))
