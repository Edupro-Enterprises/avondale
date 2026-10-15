export type SystemRoleName = 'Bursar' | 'School Head' | 'SDC Chairperson' | 'Parent' | 'Student' | 'System Admin'
export type UserAccountStatus = 'Active' | 'Suspended' | 'Invited'

export interface SystemUser {
  id: string
  name: string
  email: string
  role: SystemRoleName
  status: UserAccountStatus
  lastLogin: string
  createdDate: string
}

export const mockSystemUsers: SystemUser[] = [
  { id: 'USR-001', name: 'Tendai Marufu', email: 'bursar@mbarehigh.edu.zw', role: 'Bursar', status: 'Active', lastLogin: '2026-09-14', createdDate: '2024-01-05' },
  { id: 'USR-002', name: 'Dr. Simbarashe Moyana', email: 'head@mbarehigh.edu.zw', role: 'School Head', status: 'Active', lastLogin: '2026-09-13', createdDate: '2024-01-05' },
  { id: 'USR-003', name: 'Grace Mutasa', email: 'sdc-chair@mbarehigh.edu.zw', role: 'SDC Chairperson', status: 'Active', lastLogin: '2026-09-10', createdDate: '2024-02-12' },
  { id: 'USR-004', name: 'Kudzai Mangwiro', email: 'itadmin@mbarehigh.edu.zw', role: 'System Admin', status: 'Active', lastLogin: '2026-09-14', createdDate: '2024-01-05' },
  { id: 'USR-005', name: 'Tadiwa Moyo Sr.', email: 'tadiwa.moyo@mbarehigh.edu.zw', role: 'Parent', status: 'Active', lastLogin: '2026-09-10', createdDate: '2024-01-15' },
  { id: 'USR-006', name: 'Farai Chikafu', email: 'farai.chikafu@gmail.com', role: 'Parent', status: 'Active', lastLogin: '2026-09-08', createdDate: '2022-01-10' },
  { id: 'USR-007', name: 'Tadiwa Moyo Jr.', email: 'tadiwa.moyo.jr@mbarehigh.edu.zw', role: 'Student', status: 'Active', lastLogin: '2026-09-12', createdDate: '2024-01-15' },
  { id: 'USR-008', name: 'Tafadzwa Chirwa', email: 'tafadzwa.chirwa@gmail.com', role: 'Parent', status: 'Invited', lastLogin: '', createdDate: '2026-08-20' },
  { id: 'USR-009', name: 'Memory Nyathi', email: 'memory.nyathi@gmail.com', role: 'Parent', status: 'Suspended', lastLogin: '2026-06-02', createdDate: '2026-01-20' },
]
