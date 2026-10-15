import { useEffect, useMemo, useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronLeft, ChevronRight, LayoutList, Rows3, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** Row-action buttons (e.g. a DropdownMenu trigger in an actions column)
 * must force their size with `h-7! w-7!` rather than relying on Button's
 * `size='icon'` alone -- that variant's `max-md:size-11` touch-target rule
 * (AUD-051) otherwise wins under 768px and inflates every row past its
 * compact/comfortable target height, since a <tr> can't shrink below its
 * tallest child. */
export interface DataListColumn<T> {
  id: string
  header: string
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  /** Value to sort by, when it differs from what `cell` renders (e.g. a raw
   * number backing a formatted Money cell). Defaults to the cell's own text. */
  sortValue?: (row: T) => string | number
  className?: string
  headerClassName?: string
}

export interface DataListBulkAction<T> {
  label: string
  icon?: LucideIcon
  variant?: 'default' | 'outline' | 'destructive'
  onAction: (selected: T[]) => void
}

interface DataListProps<T> {
  data: T[]
  columns: DataListColumn<T>[]
  getRowId: (row: T) => string
  isLoading?: boolean
  emptyState: {
    icon: LucideIcon
    title: string
    description?: string
    actionLabel?: string
    onAction?: () => void
  }
  onRowClick?: (row: T) => void
  selectable?: boolean
  bulkActions?: DataListBulkAction<T>[]
  pageSize?: number
  defaultSort?: SortingState
  /** localStorage key for the compact/comfortable density toggle (AUD-035).
   * Omit to default to compact with no persistence. */
  densityStorageKey?: string
}

const ROW_HEIGHT = { compact: 'h-[34px]', comfortable: 'h-[44px]' } as const

function readDensity(key: string | undefined): 'compact' | 'comfortable' {
  if (!key) return 'compact'
  try {
    const v = localStorage.getItem(`edupro-density:${key}`)
    return v === 'comfortable' ? 'comfortable' : 'compact'
  } catch {
    return 'compact'
  }
}

/** Shared table primitive (AUD-034): real <table> semantics under the
 * hood (sticky header, column sort, sortable via TanStack Table) while
 * staying visually close to the app's existing dense row look. Bundles
 * row height (AUD-035), sort (AUD-036), pagination (AUD-037), row
 * selection + bulk actions (AUD-038), loading skeleton (AUD-039), and
 * empty state (AUD-040) so every migrated list gets all of it for free. */
export function DataList<T>({
  data,
  columns,
  getRowId,
  isLoading,
  emptyState,
  onRowClick,
  selectable,
  bulkActions,
  pageSize = 20,
  defaultSort,
  densityStorageKey,
}: DataListProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSort ?? [])
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [density, setDensity] = useState<'compact' | 'comfortable'>(() => readDensity(densityStorageKey))

  useEffect(() => {
    if (!densityStorageKey) return
    try {
      localStorage.setItem(`edupro-density:${densityStorageKey}`, density)
    } catch {
      // localStorage unavailable -- density just won't persist
    }
  }, [density, densityStorageKey])

  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = columns.map((col) => ({
      id: col.id,
      header: col.header,
      enableSorting: !!col.sortable,
      accessorFn: (row) => (col.sortValue ? col.sortValue(row) : ''),
      cell: ({ row }) => col.cell(row.original),
      meta: { className: col.className, headerClassName: col.headerClassName },
    }))
    if (selectable) {
      cols.unshift({
        id: '__select',
        header: ({ table }) => (
          <Checkbox
            aria-label='Select all rows'
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label='Select row'
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        meta: { className: 'w-8' },
      })
    }
    return cols
  }, [columns, selectable])

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    enableRowSelection: !!selectable,
  })

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const rowHeight = ROW_HEIGHT[density]

  return (
    <div>
      {(selectable || densityStorageKey) && (
        <div className='flex items-center justify-between gap-2 border-b px-2 py-1.5'>
          <div className='text-body text-muted-foreground'>
            {selectable && selectedRows.length > 0 ? `${selectedRows.length} selected` : ''}
          </div>
          {densityStorageKey && (
            <div className='flex items-center gap-0.5'>
              <Button
                variant={density === 'compact' ? 'secondary' : 'ghost'}
                size='icon'
                className='h-7 w-7'
                aria-label='Compact rows'
                title='Compact rows'
                onClick={() => setDensity('compact')}
              >
                <Rows3 className='h-3.5 w-3.5' />
              </Button>
              <Button
                variant={density === 'comfortable' ? 'secondary' : 'ghost'}
                size='icon'
                className='h-7 w-7'
                aria-label='Comfortable rows'
                title='Comfortable rows'
                onClick={() => setDensity('comfortable')}
              >
                <LayoutList className='h-3.5 w-3.5' />
              </Button>
            </div>
          )}
        </div>
      )}

      {selectable && selectedRows.length > 0 && bulkActions && bulkActions.length > 0 && (
        <div className='flex items-center gap-2 border-b bg-accent/50 px-3 py-2'>
          <span className='text-body-lg font-medium'>{selectedRows.length} selected</span>
          <div className='ms-auto flex items-center gap-2'>
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                size='sm'
                variant={action.variant ?? 'outline'}
                onClick={() => action.onAction(selectedRows)}
              >
                {action.icon && <action.icon className='h-3.5 w-3.5' />}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Table>
        <TableHeader className='sticky top-0 z-10 bg-background'>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className='hover:bg-transparent'>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as { headerClassName?: string } | undefined
                return (
                  <TableHead key={header.id} className={cn('text-body', meta?.headerClassName)}>
                    {header.column.getCanSort() ? (
                      <button
                        type='button'
                        onClick={header.column.getToggleSortingHandler()}
                        className='inline-flex items-center gap-1 hover:text-foreground'
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown
                          className={cn(
                            'h-3 w-3',
                            header.column.getIsSorted() ? 'text-foreground' : 'text-muted-foreground/50'
                          )}
                        />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className={rowHeight}>
                {tableColumns.map((col) => (
                  <TableCell key={col.id} className='py-1'>
                    <Skeleton className='h-3.5 w-full max-w-32' />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={cn(rowHeight, onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { className?: string } | undefined
                  return (
                    <TableCell key={cell.id} className={cn('text-body-lg py-1', meta?.className)}>
                      <div className='truncate'>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : (
            <TableRow className='hover:bg-transparent'>
              <TableCell colSpan={tableColumns.length} className='h-auto py-0'>
                <EmptyState {...emptyState} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {!isLoading && table.getPageCount() > 1 && (
        <div className='flex items-center justify-between gap-2 border-t px-3 py-2'>
          <span className='text-body text-muted-foreground'>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='h-7 w-7'
              aria-label='Previous page'
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft className='h-3.5 w-3.5' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-7 w-7'
              aria-label='Next page'
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight className='h-3.5 w-3.5' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
