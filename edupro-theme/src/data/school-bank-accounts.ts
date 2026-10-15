export type AccountType = 'Current' | 'Savings' | 'Nostro' | 'Call'
export type FeeStream = 'Tuition' | 'SDC Levy' | 'Boarding' | 'Project' | 'Petty Cash' | 'Other'
export type BankFund = 'Fund A' | 'Fund B' | 'Both'

export interface SchoolBankAccount {
  id: string
  label: string
  bankName: string
  branch: string
  branchCode: string
  swiftCode: string
  accountName: string
  accountNumber: string
  accountType: AccountType
  currency: 'USD' | 'ZiG'
  feeStream: FeeStream
  fund: BankFund
  signatory1: string
  signatory2: string
  minSignatures: number
  openingBalanceUSD: number
  isActive: boolean
  isDefault: boolean
}

export const mockSchoolBankAccounts: SchoolBankAccount[] = [
  {
    id: 'ACC-001',
    label: 'Tuition & General USD',
    bankName: 'CBZ Bank',
    branch: 'Harare Corporate',
    branchCode: '3700',
    swiftCode: '',
    accountName: 'Avondale Primary School',
    accountNumber: 'CBZ-4471-002',
    accountType: 'Current',
    currency: 'USD',
    feeStream: 'Tuition',
    fund: 'Fund A',
    signatory1: 'Tendai Marufu',
    signatory2: 'Farai Chikanga',
    minSignatures: 2,
    openingBalanceUSD: 4200,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'ACC-002',
    label: 'SDC Development Account',
    bankName: 'Stanbic Bank',
    branch: 'Mbare',
    branchCode: '1401',
    swiftCode: '',
    accountName: 'Avondale Primary School SDC',
    accountNumber: 'SBIC-8821-014',
    accountType: 'Current',
    currency: 'USD',
    feeStream: 'SDC Levy',
    fund: 'Fund B',
    signatory1: 'Grace Mutasa',
    signatory2: 'Farai Chikanga',
    minSignatures: 2,
    openingBalanceUSD: 9600,
    isActive: true,
    isDefault: false,
  },
  {
    id: 'ACC-003',
    label: 'Boarding Account',
    bankName: 'Steward Bank',
    branch: 'Harare',
    branchCode: '2201',
    swiftCode: '',
    accountName: 'Avondale Primary School Boarding',
    accountNumber: 'STW-5512-071',
    accountType: 'Savings',
    currency: 'USD',
    feeStream: 'Boarding',
    fund: 'Fund A',
    signatory1: 'Tendai Marufu',
    signatory2: '',
    minSignatures: 1,
    openingBalanceUSD: 1500,
    isActive: true,
    isDefault: false,
  },
  {
    id: 'ACC-004',
    label: 'Petty Cash Float',
    bankName: 'N/A — Cash Safe',
    branch: '',
    branchCode: '',
    swiftCode: '',
    accountName: 'Avondale Primary School Petty Cash',
    accountNumber: 'SAFE-01',
    accountType: 'Call',
    currency: 'USD',
    feeStream: 'Petty Cash',
    fund: 'Fund A',
    signatory1: 'Tendai Marufu',
    signatory2: '',
    minSignatures: 1,
    openingBalanceUSD: 200,
    isActive: true,
    isDefault: false,
  },
]
