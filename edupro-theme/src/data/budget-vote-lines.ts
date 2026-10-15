export type Fund = 'Fund A — General/Government' | 'Fund B — SDC/SDA'

export interface BudgetVoteLine {
  id: string
  name: string
  fund: Fund
  chartOfAccountId: string
  costCenterId: string
  approvedUSD: number
  committedUSD: number
  spentUSD: number
}

export const mockBudgetVoteLines: BudgetVoteLine[] = [
  {
    id: 'VOTE-01',
    name: 'Tuition & Government Grant Income',
    fund: 'Fund A — General/Government',
    chartOfAccountId: 'COA-4000',
    costCenterId: 'CC-01',
    approvedUSD: 12000,
    committedUSD: 3200,
    spentUSD: 6100,
  },
  {
    id: 'VOTE-02',
    name: 'Staff Welfare',
    fund: 'Fund A — General/Government',
    chartOfAccountId: 'COA-5030',
    costCenterId: 'CC-01',
    approvedUSD: 1800,
    committedUSD: 200,
    spentUSD: 950,
  },
  {
    id: 'VOTE-03',
    name: 'Stationery & Office Consumables',
    fund: 'Fund A — General/Government',
    chartOfAccountId: 'COA-5000',
    costCenterId: 'CC-01',
    approvedUSD: 1200,
    committedUSD: 150,
    spentUSD: 640,
  },
  {
    id: 'VOTE-04',
    name: 'SDC Development Fund',
    fund: 'Fund B — SDC/SDA',
    chartOfAccountId: 'COA-4010',
    costCenterId: 'CC-01',
    approvedUSD: 8000,
    committedUSD: 1500,
    spentUSD: 2200,
  },
  {
    id: 'VOTE-05',
    name: 'Boarding Operations',
    fund: 'Fund B — SDC/SDA',
    chartOfAccountId: 'COA-5010',
    costCenterId: 'CC-03',
    approvedUSD: 4500,
    committedUSD: 600,
    spentUSD: 3100,
  },
  {
    id: 'VOTE-06',
    name: 'Capital Projects — Classroom Block',
    fund: 'Fund B — SDC/SDA',
    chartOfAccountId: 'COA-5020',
    costCenterId: 'CC-06',
    approvedUSD: 10000,
    committedUSD: 4000,
    spentUSD: 400,
  },
]

/** For O(1) lookups in list rows instead of a `.find()` per row (AUD-056). */
export const budgetVoteLinesById = new Map(mockBudgetVoteLines.map((v) => [v.id, v]))
