import type { Fund } from './budget-vote-lines'

export type AssetCategory = 'Furniture & Fittings' | 'IT Equipment' | 'Motor Vehicles' | 'Buildings' | 'Machinery & Equipment'
export type DepreciationMethod = 'Straight Line' | 'Reducing Balance'
export type AssetStatus = 'In Use' | 'Under Repair' | 'Disposed' | 'Written Off'

export interface FixedAsset {
  id: string
  assetNumber: string
  name: string
  category: AssetCategory
  costCenterId: string
  fund: Fund
  acquisitionDate: string
  acquisitionCostUSD: number
  supplier: string
  depreciationMethod: DepreciationMethod
  depreciationRatePercent: number
  usefulLifeYears: number
  residualValueUSD: number
  location: string
  status: AssetStatus
  disposalDate: string
  disposalProceedsUSD: number
}

export const mockFixedAssets: FixedAsset[] = [
  {
    id: 'FA-001',
    assetNumber: 'MHS/MV/001',
    name: 'Toyota Quantum Minibus',
    category: 'Motor Vehicles',
    costCenterId: 'CC-03',
    fund: 'Fund B — SDC/SDA',
    acquisitionDate: '2023-02-14',
    acquisitionCostUSD: 18000,
    supplier: 'CFAO Motors Zimbabwe',
    depreciationMethod: 'Straight Line',
    depreciationRatePercent: 20,
    usefulLifeYears: 5,
    residualValueUSD: 3000,
    location: 'School car park',
    status: 'In Use',
    disposalDate: '',
    disposalProceedsUSD: 0,
  },
  {
    id: 'FA-002',
    assetNumber: 'MHS/IT/014',
    name: 'Konica Minolta Photocopier',
    category: 'IT Equipment',
    costCenterId: 'CC-01',
    fund: 'Fund A — General/Government',
    acquisitionDate: '2024-03-01',
    acquisitionCostUSD: 2400,
    supplier: 'Office Systems Zimbabwe',
    depreciationMethod: 'Reducing Balance',
    depreciationRatePercent: 25,
    usefulLifeYears: 5,
    residualValueUSD: 200,
    location: "Bursar's office",
    status: 'In Use',
    disposalDate: '',
    disposalProceedsUSD: 0,
  },
  {
    id: 'FA-003',
    assetNumber: 'MHS/FF/032',
    name: 'Classroom Desks & Chairs (Form 1–2 block)',
    category: 'Furniture & Fittings',
    costCenterId: 'CC-02',
    fund: 'Fund A — General/Government',
    acquisitionDate: '2022-01-18',
    acquisitionCostUSD: 3600,
    supplier: 'Mbare Stationers',
    depreciationMethod: 'Straight Line',
    depreciationRatePercent: 10,
    usefulLifeYears: 10,
    residualValueUSD: 0,
    location: 'Block A classrooms',
    status: 'In Use',
    disposalDate: '',
    disposalProceedsUSD: 0,
  },
  {
    id: 'FA-004',
    assetNumber: 'MHS/ME/007',
    name: 'Borehole Pump & Motor',
    category: 'Machinery & Equipment',
    costCenterId: 'CC-04',
    fund: 'Fund B — SDC/SDA',
    acquisitionDate: '2021-06-10',
    acquisitionCostUSD: 1800,
    supplier: 'Ridgeway Hardware',
    depreciationMethod: 'Straight Line',
    depreciationRatePercent: 12.5,
    usefulLifeYears: 8,
    residualValueUSD: 100,
    location: 'Grounds — west borehole',
    status: 'In Use',
    disposalDate: '',
    disposalProceedsUSD: 0,
  },
  {
    id: 'FA-005',
    assetNumber: 'MHS/BLD/002',
    name: 'Science Laboratory Block',
    category: 'Buildings',
    costCenterId: 'CC-06',
    fund: 'Fund B — SDC/SDA',
    acquisitionDate: '2020-01-30',
    acquisitionCostUSD: 45000,
    supplier: 'Masimba Building Supplies',
    depreciationMethod: 'Straight Line',
    depreciationRatePercent: 2.5,
    usefulLifeYears: 40,
    residualValueUSD: 5000,
    location: 'Block C',
    status: 'In Use',
    disposalDate: '',
    disposalProceedsUSD: 0,
  },
  {
    id: 'FA-006',
    assetNumber: 'MHS/IT/009',
    name: 'HP LaserJet Printer (Bursar office, retired)',
    category: 'IT Equipment',
    costCenterId: 'CC-01',
    fund: 'Fund A — General/Government',
    acquisitionDate: '2019-04-12',
    acquisitionCostUSD: 450,
    supplier: 'Office Systems Zimbabwe',
    depreciationMethod: 'Reducing Balance',
    depreciationRatePercent: 30,
    usefulLifeYears: 5,
    residualValueUSD: 30,
    location: 'Disposed',
    status: 'Disposed',
    disposalDate: '2025-08-15',
    disposalProceedsUSD: 40,
  },
]

const CURRENT_YEAR = 2026

export interface DepreciationScheduleEntry {
  year: number
  openingValueUSD: number
  depreciationUSD: number
  closingValueUSD: number
}

/** Depreciation is computed forward from acquisition cost/rate/method
 * rather than hand-entered one row per period. */
export function getDepreciationSchedule(asset: FixedAsset): DepreciationScheduleEntry[] {
  const acquisitionYear = Number(asset.acquisitionDate.slice(0, 4))
  const disposalYear = asset.disposalDate ? Number(asset.disposalDate.slice(0, 4)) : CURRENT_YEAR
  const lastYear = Math.min(acquisitionYear + asset.usefulLifeYears - 1, disposalYear)

  const entries: DepreciationScheduleEntry[] = []
  let openingValue = asset.acquisitionCostUSD
  for (let year = acquisitionYear; year <= lastYear; year++) {
    const rawDepreciation =
      asset.depreciationMethod === 'Straight Line'
        ? (asset.acquisitionCostUSD - asset.residualValueUSD) / asset.usefulLifeYears
        : openingValue * (asset.depreciationRatePercent / 100)
    const closingValue = Math.max(openingValue - rawDepreciation, asset.residualValueUSD)
    entries.push({ year, openingValueUSD: openingValue, depreciationUSD: openingValue - closingValue, closingValueUSD: closingValue })
    openingValue = closingValue
  }
  return entries
}

export function getCurrentBookValue(asset: FixedAsset): number {
  const schedule = getDepreciationSchedule(asset)
  return schedule.length > 0 ? schedule[schedule.length - 1].closingValueUSD : asset.acquisitionCostUSD
}

export function getTotalNetBookValue(): number {
  return mockFixedAssets.reduce((sum, a) => sum + getCurrentBookValue(a), 0)
}

/** Depreciation expense for one year across the whole register — the
 * non-cash charge that distinguishes the Statement of Comprehensive
 * Income from the cash-basis Statement of Receipts & Payments. */
export function getTotalDepreciationForYear(year: number): number {
  return mockFixedAssets.reduce((sum, a) => {
    const entry = getDepreciationSchedule(a).find((e) => e.year === year)
    return sum + (entry?.depreciationUSD ?? 0)
  }, 0)
}
