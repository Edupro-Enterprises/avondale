/** Builds the PdfSection[] content for a student's Profile or Statement --
 * shared by Payment Desk's Student Lookup and the Student detail page, so
 * both "view profile" entry points produce the exact same document. */
import type { PdfSection } from '@/lib/export'
import type { FrappeStudentDetail, FrappeGuardian } from '@/lib/frappe/students'
import type { FrappeInvoice } from '@/lib/frappe/invoices'
import type { FrappeReceipt } from '@/lib/frappe/receipts'
import type { FrappeBankingConfigRow } from '@/lib/frappe/school-setup'
import { formatStudentName } from '@/lib/utils'

export function verificationUrlForStudent(studentId: string): string {
  return `${window.location.origin}/verify-document?student=${encodeURIComponent(studentId)}`
}

export function buildProfileSections(student: FrappeStudentDetail, guardians: FrappeGuardian[]): PdfSection[] {
  const sections: PdfSection[] = [
    {
      heading: 'Core Identity',
      columns: ['Field', 'Value'],
      rows: [
        ['Student ID', student.name],
        ['Name', formatStudentName(student.first_name, student.last_name)],
        ['Address', student.home_address ?? '—'],
        ['Class / Stream', student.grade ?? '—'],
        ['Date of Birth', student.date_of_birth ?? '—'],
        ['Gender', student.gender ?? '—'],
        ['Admission Date', student.admission_date],
        ['Academic Year', student.academic_year],
        ['Beneficiary Category', student.beneficiary_category],
        ['Status', student.status],
      ],
    },
  ]

  if (guardians.length > 0) {
    sections.push({
      heading: 'Guardians',
      columns: ['Name', 'Relationship', 'Phone', 'Email'],
      rows: guardians.map((g) => [g.full_name, g.relationship ?? '—', g.phone_number ?? '—', g.email ?? '—']),
    })
  }

  return sections
}

export interface StatementDocument {
  sections: PdfSection[]
  totalBalanceUSD: number
}

/** bankAccounts, when given, appends a "School Banking Details" section at
 * the bottom of the statement (item 4) -- omitted for a school with no
 * banking configured yet rather than printing an empty section. */
export function buildStatementSections(
  invoices: FrappeInvoice[],
  receipts: FrappeReceipt[],
  receiptAmountUSD: (r: FrappeReceipt) => number,
  bankAccounts: FrappeBankingConfigRow[] = []
): StatementDocument {
  // A Consolidated invoice's full total_amount is already re-stated as a
  // "Balance brought forward" line on the invoice that absorbed it, so
  // including it here too would double/triple-count the same debt in both
  // the ledger rows and totalBalanceUSD.
  const activeInvoices = invoices.filter((i) => i.status !== 'Consolidated')

  const lines = [
    ...activeInvoices.map((i) => ({
      date: i.posting_date,
      description: `Invoice ${i.name} (${i.term})`,
      debit: i.total_amount,
      credit: 0,
    })),
    ...receipts.map((r) => ({
      date: r.posting_date,
      description: `Receipt ${r.name} (${r.payment_method})`,
      debit: 0,
      credit: receiptAmountUSD(r),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  let balance = 0
  const rows = lines.map((l) => {
    balance += l.debit - l.credit
    return [l.date, l.description, l.debit ? l.debit.toFixed(2) : '—', l.credit ? l.credit.toFixed(2) : '—', balance.toFixed(2)]
  })

  const sections: PdfSection[] = [
    {
      columns: ['Date', 'Description', 'Charged (USD)', 'Paid (USD)', 'Balance (USD)'],
      rows,
    },
  ]

  const activeAccounts = bankAccounts.filter((a) => a.is_active)
  if (activeAccounts.length > 0) {
    sections.push({
      heading: 'School Banking Details',
      columns: ['Bank', 'Fee Stream', 'Account Name', 'Account Number', 'Currency'],
      rows: activeAccounts.map((a) => [a.bank_name, a.fee_stream, a.account_name, a.account_number, a.currency_type]),
    })
  }

  return { sections, totalBalanceUSD: balance }
}
