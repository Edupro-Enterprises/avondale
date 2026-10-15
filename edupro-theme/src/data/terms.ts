export type TermStatus = 'Upcoming' | 'Open' | 'Closed'

export interface Term {
  id: string
  academicYearId: string
  name: string
  startDate: string
  endDate: string
  midTermBreakStart: string
  midTermBreakEnd: string
  examStartDate: string
  examEndDate: string
  feesDueDate: string
  status: TermStatus
  isCurrent: boolean
}

export const mockTerms: Term[] = [
  {
    id: 'TERM-2026-1',
    academicYearId: 'AY-2026',
    name: 'Term 1',
    startDate: '2026-01-12',
    endDate: '2026-04-10',
    midTermBreakStart: '2026-02-23',
    midTermBreakEnd: '2026-03-02',
    examStartDate: '2026-04-01',
    examEndDate: '2026-04-09',
    feesDueDate: '2026-01-26',
    status: 'Open',
    isCurrent: true,
  },
  {
    id: 'TERM-2026-2',
    academicYearId: 'AY-2026',
    name: 'Term 2',
    startDate: '2026-05-04',
    endDate: '2026-08-07',
    midTermBreakStart: '2026-06-15',
    midTermBreakEnd: '2026-06-22',
    examStartDate: '2026-07-27',
    examEndDate: '2026-08-06',
    feesDueDate: '2026-05-18',
    status: 'Upcoming',
    isCurrent: false,
  },
  {
    id: 'TERM-2026-3',
    academicYearId: 'AY-2026',
    name: 'Term 3',
    startDate: '2026-09-07',
    endDate: '2026-12-04',
    midTermBreakStart: '2026-10-19',
    midTermBreakEnd: '2026-10-26',
    examStartDate: '2026-11-23',
    examEndDate: '2026-12-03',
    feesDueDate: '2026-09-21',
    status: 'Upcoming',
    isCurrent: false,
  },
]
