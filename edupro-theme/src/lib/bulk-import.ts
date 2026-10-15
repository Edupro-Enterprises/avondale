/** Client-side XLSX template download + upload-parse for bulk import --
 * mirrors export.ts's downloadXlsx (same ExcelJS dependency, same
 * client-side-only approach, no server round trip until each row is
 * actually submitted through the normal create/update hooks). */
import ExcelJS from 'exceljs'

export async function downloadImportTemplate(filename: string, sheetName: string, headers: string[], sampleRow: Array<string | number>) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Import')
  sheet.addRow(headers)
  sheet.getRow(1).font = { bold: true }
  sheet.addRow(sampleRow)
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF888888' } }
  sheet.columns.forEach((col) => { col.width = 22 })
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Reads the first worksheet of an uploaded .xlsx into row objects keyed by
 * the header row's own text -- so column order in the uploaded file doesn't
 * matter, only the header names do. Skips the template's own italicised
 * sample row only if the caller's parseRow rejects it (e.g. a placeholder
 * value like "John") rather than trying to detect it structurally. */
export async function parseXlsxRows(file: File): Promise<Array<Record<string, string>>> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => { headers[colNumber] = String(cell.value ?? '').trim() })

  const rows: Array<Record<string, string>> = []
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    if (row.cellCount === 0) continue
    const record: Record<string, string> = {}
    let hasValue = false
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber]
      if (!header) return
      const value = cell.value
      const text = value === null || value === undefined ? '' : String(value instanceof Date ? value.toISOString().slice(0, 10) : value).trim()
      record[header] = text
      if (text) hasValue = true
    })
    if (hasValue) rows.push(record)
  }
  return rows
}
