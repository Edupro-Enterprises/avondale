import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export interface BackupFile {
  filename: string
  size: number
  modified: string
}

const MODULE = 'edupro_school_fees.backup'

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: async () => (await api.get<{ message: BackupFile[] }>(`/api/method/${MODULE}.list_backups`)).message,
  })
}

export function useRunBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post<{ message: unknown }>(`/api/method/${MODULE}.run_backup`, {})).message,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  })
}

export function backupDownloadUrl(filename: string) {
  return `/api/method/${MODULE}.download_backup?filename=${encodeURIComponent(filename)}`
}
