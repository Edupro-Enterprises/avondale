import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Declarative table for financial figures -- a plain markdown table
 * already renders fine via remark-gfm, but this adds tabular-nums (digits
 * line up column-wise, important for money) and a caption slot, which a
 * markdown table has no syntax for. */
export function DataTable({
  headers,
  rows,
  caption,
}: {
  headers: string[]
  rows: (string | number)[][]
  caption?: string
}) {
  return (
    <div className='my-4 overflow-x-auto rounded-lg border'>
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j} className='tabular-nums'>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
