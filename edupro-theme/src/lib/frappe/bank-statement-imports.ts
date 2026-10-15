/** Bank Statement Import doctype access -- see the backend repo's
 * edupro_school_fees/doctype/bank_statement_import/bank_statement_import.py.
 * A Bursar attaches a CSV, parse_statement() reads it into lines and runs a
 * conservative auto-match against open Invoices (only when a line names an
 * Invoice directly, or exactly one Active student + exactly one of their
 * invoices whose outstanding balance matches the line amount exactly) --
 * anything short of that is left for set_manual_match(). Nothing posts to
 * the ledger until confirm_statement_line() explicitly confirms one line,
 * always a human action, never automatic. Confirmed real gap: this whole
 * flow existed backend-only with zero frontend before this. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource, uploadFile } from './client'

export interface FrappeBankStatementLine {
  name: string
  transaction_date: string
  description: string
  reference: string
  amount: number
  match_status: 'Unmatched' | 'Matched' | 'Manual Review' | 'Posted'
  matched_invoice?: string
  matched_student?: string
  receipt?: string
}

export interface FrappeBankStatementImport {
  name: string
  bank_account: string
  statement_file: string
  import_date: string
  status: 'Draft' | 'Parsed' | 'Completed'
}

export interface FrappeBankStatementImportDetail extends FrappeBankStatementImport {
  lines: FrappeBankStatementLine[]
}

const IMPORT_FIELDS = ['name', 'bank_account', 'statement_file', 'import_date', 'status']

export function useBankStatementImports() {
  return useQuery({
    queryKey: ['bank-statement-imports'],
    queryFn: async () => {
      const res = await listResource<FrappeBankStatementImport>('Bank Statement Import', {
        fields: JSON.stringify(IMPORT_FIELDS),
        order_by: 'creation desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useBankStatementImport(name: string | undefined) {
  return useQuery({
    queryKey: ['bank-statement-import', name],
    queryFn: async () =>
      (
        await api.get<{ data: FrappeBankStatementImportDetail }>(
          `/api/resource/Bank Statement Import/${encodeURIComponent(name!)}`
        )
      ).data,
    enabled: !!name,
  })
}

export function useCreateBankStatementImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ bankAccount, file, importDate }: { bankAccount: string; file: File; importDate: string }) => {
      const fileUrl = await uploadFile(file, { isPrivate: true })
      const created = await api.post<{ data: { name: string } }>('/api/resource/Bank Statement Import', {
        bank_account: bankAccount,
        statement_file: fileUrl,
        import_date: importDate,
      })
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-statement-imports'] }),
  })
}

const BSI_MODULE = 'edupro_school_fees.edupro_school_fees.doctype.bank_statement_import.bank_statement_import'

function invalidateImport(queryClient: ReturnType<typeof useQueryClient>, name: string) {
  queryClient.invalidateQueries({ queryKey: ['bank-statement-imports'] })
  queryClient.invalidateQueries({ queryKey: ['bank-statement-import', name] })
}

export function useParseStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (bankStatementImport: string) => {
      const res = await api.post<{ message: { lines_added: number } }>(`/api/method/${BSI_MODULE}.parse_statement`, {
        bank_statement_import: bankStatementImport,
      })
      return res.message
    },
    onSuccess: (_data, bankStatementImport) => invalidateImport(queryClient, bankStatementImport),
  })
}

export function useSetManualMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ bankStatementImport, rowName, invoice }: { bankStatementImport: string; rowName: string; invoice: string }) => {
      await api.post(`/api/method/${BSI_MODULE}.set_manual_match`, {
        bank_statement_import: bankStatementImport,
        row_name: rowName,
        invoice,
      })
    },
    onSuccess: (_data, { bankStatementImport }) => invalidateImport(queryClient, bankStatementImport),
  })
}

export function useConfirmStatementLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ bankStatementImport, rowName }: { bankStatementImport: string; rowName: string }) => {
      const res = await api.post<{ message: string }>(`/api/method/${BSI_MODULE}.confirm_statement_line`, {
        bank_statement_import: bankStatementImport,
        row_name: rowName,
      })
      return res.message
    },
    onSuccess: (_data, { bankStatementImport }) => {
      invalidateImport(queryClient, bankStatementImport)
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
