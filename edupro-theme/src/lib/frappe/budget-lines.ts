/** Budget Line / Budget Vote Book doctype access -- see the backend repo's
 * edupro_school_fees/doctype/budget_line/budget_line.json and
 * edupro_school_fees/doctype/budget_vote_book/budget_vote_book.json. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, listResource } from './client'
import type { Fund } from './journal-entries'

export interface FrappeBudgetLine {
  name: string
  budget_vote_book: string
  vote_code: string
  description: string
  fund: Fund
  expense_account: string
  is_capital_project: 0 | 1
  project_name?: string
  approved_budget: number
  committed_amount: number
  actual_spend: number
  available_balance: number
}

const BUDGET_LINE_FIELDS = [
  'name', 'budget_vote_book', 'vote_code', 'description', 'fund', 'expense_account',
  'is_capital_project', 'project_name', 'approved_budget', 'committed_amount', 'actual_spend', 'available_balance',
]

export function useBudgetLines() {
  return useQuery({
    queryKey: ['budget-lines'],
    queryFn: async () => {
      const res = await listResource<FrappeBudgetLine>('Budget Line', {
        fields: JSON.stringify(BUDGET_LINE_FIELDS),
        order_by: 'vote_code asc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export interface NewBudgetLineInput {
  budget_vote_book: string
  vote_code: string
  description: string
  fund: Fund
  expense_account: string
  approved_budget: number
  is_capital_project?: 0 | 1
  project_name?: string
}

export function useCreateBudgetLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewBudgetLineInput) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Budget Line', input)
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-lines'] }),
  })
}

export interface FrappeBudgetVoteBook {
  name: string
  academic_year: string
  workflow_state: 'Draft' | 'Active' | 'Closed'
}

export function useBudgetVoteBooks() {
  return useQuery({
    queryKey: ['budget-vote-books'],
    queryFn: async () => {
      const res = await listResource<FrappeBudgetVoteBook>('Budget Vote Book', {
        fields: JSON.stringify(['name', 'academic_year', 'workflow_state']),
        order_by: 'academic_year desc',
        limit_page_length: '0',
      })
      return res.data
    },
  })
}

export function useCreateBudgetVoteBook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (academicYear: string) => {
      const created = await api.post<{ data: { name: string } }>('/api/resource/Budget Vote Book', { academic_year: academicYear })
      return created.data.name
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-vote-books'] }),
  })
}

export function useSetBudgetVoteBookState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, workflow_state }: { name: string; workflow_state: FrappeBudgetVoteBook['workflow_state'] }) => {
      await api.put(`/api/resource/Budget Vote Book/${encodeURIComponent(name)}`, { workflow_state })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-vote-books'] }),
  })
}
