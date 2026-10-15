export interface ClassStream {
  id: string
  name: string
  gradeGroupId: string
  form: string
  classTeacher: string
  roomNumber: string
  capacity: number
}

export const mockClassStreams: ClassStream[] = [
  { id: 'CS-1A', name: 'Form 1A', gradeGroupId: 'GG-JC', form: 'Form 1A', classTeacher: 'Mrs. Chidziva', roomNumber: 'Block A-1', capacity: 45 },
  { id: 'CS-1C', name: 'Form 1C', gradeGroupId: 'GG-JC', form: 'Form 1C', classTeacher: 'Mr. Gono', roomNumber: 'Block A-3', capacity: 45 },
  { id: 'CS-2A', name: 'Form 2A', gradeGroupId: 'GG-JC', form: 'Form 2A', classTeacher: 'Mrs. Ndoro', roomNumber: 'Block A-5', capacity: 45 },
  { id: 'CS-4B', name: 'Form 4B', gradeGroupId: 'GG-OL', form: 'Form 4B', classTeacher: 'Mr. Mapfumo', roomNumber: 'Block B-2', capacity: 40 },
  { id: 'CS-6A', name: 'Form 6A', gradeGroupId: 'GG-AL', form: 'Form 6A', classTeacher: 'Mrs. Sithole', roomNumber: 'Block C-1', capacity: 35 },
]
