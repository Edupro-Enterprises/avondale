import type { Fund } from './budget-vote-lines'

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'

export interface ChartOfAccount {
  id: string
  code: string
  name: string
  type: AccountType
  fund: Fund | 'Both'
  isActive: boolean
}

export const mockChartOfAccounts: ChartOfAccount[] = [
  { id: 'COA-1000', code: '1000', name: 'Bank — Tuition & General USD', type: 'Asset', fund: 'Fund A — General/Government', isActive: true },
  { id: 'COA-1010', code: '1010', name: 'Bank — SDC Development Account', type: 'Asset', fund: 'Fund B — SDC/SDA', isActive: true },
  { id: 'COA-1020', code: '1020', name: 'Petty Cash', type: 'Asset', fund: 'Both', isActive: true },
  { id: 'COA-1100', code: '1100', name: 'Debtors Control', type: 'Asset', fund: 'Both', isActive: true },
  { id: 'COA-2100', code: '2100', name: 'Creditors Control', type: 'Liability', fund: 'Both', isActive: true },
  { id: 'COA-4000', code: '4000', name: 'Tuition Income', type: 'Income', fund: 'Fund A — General/Government', isActive: true },
  { id: 'COA-4010', code: '4010', name: 'SDC Levy Income', type: 'Income', fund: 'Fund B — SDC/SDA', isActive: true },
  { id: 'COA-4020', code: '4020', name: 'Boarding Income', type: 'Income', fund: 'Fund B — SDC/SDA', isActive: true },
  { id: 'COA-4030', code: '4030', name: 'School Shop Income', type: 'Income', fund: 'Fund A — General/Government', isActive: true },
  { id: 'COA-5000', code: '5000', name: 'Stationery & Office Consumables', type: 'Expense', fund: 'Fund A — General/Government', isActive: true },
  { id: 'COA-5010', code: '5010', name: 'Boarding Operations', type: 'Expense', fund: 'Fund B — SDC/SDA', isActive: true },
  { id: 'COA-5020', code: '5020', name: 'Capital Projects', type: 'Expense', fund: 'Fund B — SDC/SDA', isActive: true },
  { id: 'COA-5030', code: '5030', name: 'Staff Welfare', type: 'Expense', fund: 'Fund A — General/Government', isActive: true },
]

/** For O(1) lookups in list rows instead of a `.find()` per row (AUD-056). */
export const chartOfAccountsById = new Map(mockChartOfAccounts.map((a) => [a.id, a]))
