import { createFileRoute } from '@tanstack/react-router'
import { Clock, DatabaseBackup, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { BursarHeader } from '@/components/layout/bursar-header'
import { FrappeApiError } from '@/lib/frappe/client'
import { useBackups, useRunBackup, backupDownloadUrl, type BackupFile } from '@/lib/frappe/backup'

export const Route = createFileRoute('/_authenticated/bursar/settings/backup')({
  component: BackupPage,
})

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Mirrors backup.py's _BACKUP_FILE_SUFFIXES / _backup_set_key -- groups the
// (up to) 4 files one backup run produces into a single row, each with its
// own download link, instead of a flat list that gets unreadable once the
// daily schedule has run for a while.
const COMPONENT_SUFFIXES: Array<[string, string]> = [
  ['-database.sql.gz', 'Database'],
  ['-database.enc.sql.gz', 'Database'],
  ['-files.tar', 'Files'],
  ['-files.enc.tar', 'Files'],
  ['-private-files.tar', 'Private Files'],
  ['-private-files.enc.tar', 'Private Files'],
  ['-site_config_backup.json', 'Config'],
]

interface BackupSet {
  key: string
  modified: string
  components: Array<{ label: string; file: BackupFile }>
}

function groupBackups(files: BackupFile[]): BackupSet[] {
  const sets = new Map<string, BackupSet>()
  for (const file of files) {
    const match = COMPONENT_SUFFIXES.find(([suffix]) => file.filename.endsWith(suffix))
    const label = match?.[1] ?? 'File'
    const key = match ? file.filename.slice(0, -match[0].length) : file.filename
    const set = sets.get(key) ?? { key, modified: file.modified, components: [] }
    set.components.push({ label, file })
    if (file.modified > set.modified) set.modified = file.modified
    sets.set(key, set)
  }
  return Array.from(sets.values()).sort((a, b) => (a.modified < b.modified ? 1 : -1))
}

function BackupPage() {
  const { data: backups, isLoading, error } = useBackups()
  const runBackup = useRunBackup()
  const sets = groupBackups(backups ?? [])

  async function handleRunBackup() {
    try {
      await runBackup.mutateAsync()
      toast.success('Backup created')
    } catch (err) {
      toast.error(err instanceof FrappeApiError ? (err.serverMessages?.[0] ?? err.message) : 'Could not create a backup.')
    }
  }

  return (
    <>
      <BursarHeader />
      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <p className='mb-1 text-sm font-medium text-primary'>Settings</p>
            <h1 className='text-3xl font-bold tracking-tight'>Backup</h1>
            <p className='text-sm text-muted-foreground'>Create and download backups of the school's data.</p>
          </div>
          <Button onClick={handleRunBackup} disabled={runBackup.isPending}>
            <DatabaseBackup className='h-4 w-4' />
            {runBackup.isPending ? 'Backing up…' : 'Backup now'}
          </Button>
        </div>

        <Card className='mb-6'>
          <CardContent className='flex items-center gap-3 py-4 text-sm'>
            <Clock className='h-4 w-4 shrink-0 text-primary' />
            <span>
              <strong>Automatic backups</strong> run every night at 2:00am (database + all files), keeping the most recent 30 — older backups are deleted automatically to free up space.
            </span>
          </CardContent>
        </Card>

        {error && (
          <Card className='mb-6 border-destructive/50'><CardContent className='py-4 text-sm text-destructive'>Couldn't load backups from the server. Try refreshing the page.</CardContent></Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent backups</CardTitle>
            <CardDescription>{sets.length} kept (up to 30)</CardDescription>
          </CardHeader>
          <CardContent className='pt-0'>
            {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}
            {sets.length === 0 && !isLoading && (
              <p className='py-6 text-center text-sm text-muted-foreground'>No backups yet — click "Backup now" to create one, or wait for tonight's automatic run.</p>
            )}
            {sets.length > 0 && (
              <div className='divide-y'>
                {sets.map((set) => (
                  <div key={set.key} className='flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='flex flex-col'>
                      <span className='text-sm font-medium'>{new Date(set.modified).toLocaleString()}</span>
                      <span className='text-xs text-muted-foreground'>
                        {set.components.map((c) => `${c.label} (${formatBytes(c.file.size)})`).join(' · ')}
                      </span>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      {set.components.map((c) => (
                        <Button key={c.file.filename} variant='outline' size='sm' asChild>
                          <a href={backupDownloadUrl(c.file.filename)}><Download className='h-3.5 w-3.5' />{c.label}</a>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
