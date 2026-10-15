export interface GradeGroup {
  id: string
  name: string
  level: 'ECD' | 'Primary' | 'Secondary'
  sortOrder: number
  formsIncluded: string
}

export const mockGradeGroups: GradeGroup[] = [
  { id: 'GG-JC', name: 'Junior Certificate', level: 'Secondary', sortOrder: 1, formsIncluded: 'Form 1 – Form 2' },
  { id: 'GG-OL', name: 'O-Level', level: 'Secondary', sortOrder: 2, formsIncluded: 'Form 3 – Form 4' },
  { id: 'GG-AL', name: 'A-Level', level: 'Secondary', sortOrder: 3, formsIncluded: 'Form 5 – Form 6' },
]

/** For O(1) lookups in list rows instead of a `.find()` per row (AUD-056). */
export const gradeGroupsById = new Map(mockGradeGroups.map((g) => [g.id, g]))
