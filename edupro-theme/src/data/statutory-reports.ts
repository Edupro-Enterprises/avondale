export interface StatementLine {
  label: string
  fund: 'Fund A' | 'Fund B'
  amountUSD: number
}

/** Statement of Receipts & Payments — Term 1, 2026. Cash-basis, matching
 * the format submitted to the SDC AGM and MoPSE District Office. */
export const receiptsPaymentsStatement = {
  openingBalances: [
    { label: 'Balance brought forward', fund: 'Fund A', amountUSD: 1850 },
    { label: 'Balance brought forward', fund: 'Fund B', amountUSD: 3240 },
  ] satisfies StatementLine[],

  receipts: [
    { label: 'Tuition Fees', fund: 'Fund A', amountUSD: 4200 },
    { label: 'Government Per Capita Grant', fund: 'Fund A', amountUSD: 1800 },
    { label: 'BEAM Disbursements', fund: 'Fund A', amountUSD: 750 },
    { label: 'School Shop / Uniform Sales', fund: 'Fund A', amountUSD: 480 },
    { label: 'Interest Received', fund: 'Fund A', amountUSD: 45 },
    { label: 'SDC Development Levy', fund: 'Fund B', amountUSD: 5600 },
    { label: 'Boarding Fees', fund: 'Fund B', amountUSD: 3200 },
    { label: 'Transport Levy', fund: 'Fund B', amountUSD: 640 },
    { label: 'Donations & Grants', fund: 'Fund B', amountUSD: 900 },
    { label: 'Fundraising Income', fund: 'Fund B', amountUSD: 350 },
    { label: 'Sundry / Other Income', fund: 'Fund B', amountUSD: 120 },
  ] satisfies StatementLine[],

  payments: [
    { label: 'Staff Welfare', fund: 'Fund A', amountUSD: 950 },
    { label: 'Stationery & Office Consumables', fund: 'Fund A', amountUSD: 640 },
    { label: 'ZIMSEC Examination Fees', fund: 'Fund A', amountUSD: 480 },
    { label: 'Water & Electricity', fund: 'Fund A', amountUSD: 890 },
    { label: 'Telephone & Internet', fund: 'Fund A', amountUSD: 210 },
    { label: 'Insurance', fund: 'Fund A', amountUSD: 340 },
    { label: 'Audit Fees', fund: 'Fund A', amountUSD: 600 },
    { label: 'Bank Charges', fund: 'Fund A', amountUSD: 95 },
    { label: 'Petty Cash Top-ups', fund: 'Fund A', amountUSD: 300 },
    { label: 'Salaries & Wages (SDC-employed staff)', fund: 'Fund B', amountUSD: 3800 },
    { label: 'Boarding Operations (food & consumables)', fund: 'Fund B', amountUSD: 2950 },
    { label: 'Repairs & Maintenance', fund: 'Fund B', amountUSD: 1100 },
    { label: 'Capital Projects (Classroom Block)', fund: 'Fund B', amountUSD: 4000 },
    { label: 'Transport (fuel & servicing)', fund: 'Fund B', amountUSD: 780 },
    { label: 'Sports & Extracurricular', fund: 'Fund B', amountUSD: 420 },
    { label: 'Library & Teaching Materials', fund: 'Fund B', amountUSD: 560 },
  ] satisfies StatementLine[],
}

/** Statement of Comprehensive Income — accrual basis. Income and
 * expenditure totals mirror the cash statement's receipts/payments;
 * Depreciation is the one non-cash line, computed from the Fixed
 * Asset Register (see getTotalDepreciationForYear). */
export const comprehensiveIncomeStatement = {
  income: [
    { label: 'Tuition Fee Income', fund: 'Fund A', amountUSD: 4200 },
    { label: 'Government Grant Income', fund: 'Fund A', amountUSD: 1800 },
    { label: 'BEAM Income', fund: 'Fund A', amountUSD: 750 },
    { label: 'School Shop Income', fund: 'Fund A', amountUSD: 480 },
    { label: 'Interest Income', fund: 'Fund A', amountUSD: 45 },
    { label: 'SDC Levy Income', fund: 'Fund B', amountUSD: 5600 },
    { label: 'Boarding Income', fund: 'Fund B', amountUSD: 3200 },
    { label: 'Transport Levy Income', fund: 'Fund B', amountUSD: 640 },
    { label: 'Donations & Grants', fund: 'Fund B', amountUSD: 900 },
    { label: 'Fundraising Income', fund: 'Fund B', amountUSD: 350 },
    { label: 'Sundry Income', fund: 'Fund B', amountUSD: 120 },
  ] satisfies StatementLine[],

  expenditureExcludingDepreciation: [
    { label: 'Staff Costs', fund: 'Fund A', amountUSD: 950 },
    { label: 'Stationery & Consumables', fund: 'Fund A', amountUSD: 640 },
    { label: 'Examination Fees', fund: 'Fund A', amountUSD: 480 },
    { label: 'Utilities', fund: 'Fund A', amountUSD: 890 },
    { label: 'Telephone & Internet', fund: 'Fund A', amountUSD: 210 },
    { label: 'Insurance', fund: 'Fund A', amountUSD: 340 },
    { label: 'Audit Fees', fund: 'Fund A', amountUSD: 600 },
    { label: 'Bank Charges', fund: 'Fund A', amountUSD: 95 },
    { label: 'Petty Cash Expenses', fund: 'Fund A', amountUSD: 300 },
    { label: 'Salaries & Wages', fund: 'Fund B', amountUSD: 3800 },
    { label: 'Boarding Operations', fund: 'Fund B', amountUSD: 2950 },
    { label: 'Repairs & Maintenance', fund: 'Fund B', amountUSD: 1100 },
    { label: 'Capital Project Costs Expensed', fund: 'Fund B', amountUSD: 4000 },
    { label: 'Transport', fund: 'Fund B', amountUSD: 780 },
    { label: 'Sports & Extracurricular', fund: 'Fund B', amountUSD: 420 },
    { label: 'Library & Teaching Materials', fund: 'Fund B', amountUSD: 560 },
  ] satisfies StatementLine[],

  /** Accumulated Fund at the start of the period — chosen so the
   * Statement of Financial Position balances once the period's
   * surplus/(deficit) and the Fixed Asset Register's net book value
   * are added in. */
  accumulatedFundBroughtForwardUSD: 68086.13,
}

/** Statement of Financial Position line items that aren't already
 * computed live from another phase's data (bank balances, debtors,
 * and fixed assets are pulled in directly on the report page). */
export const financialPositionStatement = {
  creditorsUSD: 600, // ties to PV-2026-00002, still Pending SDC Co-Approval
}
