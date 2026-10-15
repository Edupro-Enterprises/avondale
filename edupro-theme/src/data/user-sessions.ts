import type { SystemRoleName } from './system-users'

export interface UserSession {
  id: string
  userName: string
  userEmail: string
  role: SystemRoleName
  device: string
  ipAddress: string
  startedAt: string
  lastActiveAt: string
}

export const mockUserSessions: UserSession[] = [
  { id: 'SESS-1001', userName: 'Tendai Marufu', userEmail: 'bursar@mbarehigh.edu.zw', role: 'Bursar', device: 'Chrome on Windows', ipAddress: '41.191.32.10', startedAt: '2026-09-14 08:12', lastActiveAt: '2026-09-14 10:41' },
  { id: 'SESS-1004', userName: 'Dr. Simbarashe Moyana', userEmail: 'head@mbarehigh.edu.zw', role: 'School Head', device: 'Safari on macOS', ipAddress: '41.191.32.22', startedAt: '2026-09-13 07:50', lastActiveAt: '2026-09-13 16:05' },
  { id: 'SESS-2214', userName: 'Chipo Mavhunga', userEmail: 'chipo.mavhunga@gmail.com', role: 'Parent', device: 'Chrome on Android', ipAddress: '102.130.44.7', startedAt: '2026-08-30 16:02', lastActiveAt: '2026-08-30 16:14' },
  { id: 'SESS-2891', userName: 'Blessing Sithole', userEmail: 'blessing.sithole@gmail.com', role: 'Parent', device: 'Safari on iPhone', ipAddress: '102.130.51.19', startedAt: '2026-09-11 06:45', lastActiveAt: '2026-09-11 06:58' },
  { id: 'SESS-3300', userName: 'Kudzai Mangwiro', userEmail: 'itadmin@mbarehigh.edu.zw', role: 'System Admin', device: 'Chrome on Windows', ipAddress: '41.191.32.5', startedAt: '2026-09-14 07:30', lastActiveAt: '2026-09-14 10:50' },
]
