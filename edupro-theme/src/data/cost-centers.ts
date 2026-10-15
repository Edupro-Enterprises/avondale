export interface CostCenter {
  id: string
  code: string
  name: string
  department: string
  isActive: boolean
}

export const mockCostCenters: CostCenter[] = [
  { id: 'CC-01', code: 'ADMIN', name: 'Administration', department: "Bursar's Office", isActive: true },
  { id: 'CC-02', code: 'ACAD', name: 'Academic', department: 'Teaching & Learning', isActive: true },
  { id: 'CC-03', code: 'BOARD', name: 'Boarding', department: 'Boarding Houses', isActive: true },
  { id: 'CC-04', code: 'GROUNDS', name: 'Grounds & Maintenance', department: 'Facilities', isActive: true },
  { id: 'CC-05', code: 'SPORT', name: 'Sports & Extracurricular', department: 'Student Affairs', isActive: true },
  { id: 'CC-06', code: 'CAPEX', name: 'Capital Projects', department: 'Development Committee', isActive: true },
]

/** For O(1) lookups in list rows instead of a `.find()` per row (AUD-056). */
export const costCentersById = new Map(mockCostCenters.map((c) => [c.id, c]))
