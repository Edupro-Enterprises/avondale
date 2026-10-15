import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '@/features/legal/legal-page'

export const Route = createFileRoute('/(public)/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage title='Privacy Policy' updated='17 September 2026'>
      <section>
        <p>
          This Privacy Policy explains what information this school's finance portal
          collects, why, and how it is protected. It covers student, guardian, and
          staff data handled through the Service.
        </p>
      </section>

      <section>
        <h2>1. Information we hold</h2>
        <ul>
          <li>Student records: name, grade/class, admission details, and fee/payment history.</li>
          <li>Guardian records: name, relationship to the student, contact details, and national ID where provided.</li>
          <li>Staff/user accounts: name, email, role, and login activity.</li>
          <li>Financial records: invoices, receipts, payment plans, and related transaction details.</li>
        </ul>
      </section>

      <section>
        <h2>2. Why we hold it</h2>
        <p>This information is used to:</p>
        <ul>
          <li>Bill and record school fees accurately, in either ZiG or USD.</li>
          <li>Give parents/guardians and students visibility into their own family's fee balance and payment history.</li>
          <li>Support the school's statutory and audit obligations (e.g. PRAZ procurement records, MoPSE reporting).</li>
          <li>Maintain an accurate financial audit trail for the school's governing bodies (School Head, SDC).</li>
        </ul>
      </section>

      <section>
        <h2>3. Children's information</h2>
        <p>
          Many records in this system concern students who are minors. Student data is
          only ever visible to that student's own account, their linked
          parent/guardian, and school staff whose role requires it (Bursar, School
          Head, and relevant auditors) -- never to another family or an unrelated
          student.
        </p>
      </section>

      <section>
        <h2>4. Who can see what</h2>
        <p>
          Access is scoped by role: a parent/guardian or student can only see records
          for their own family. Bursars and School Heads see school-wide financial
          data needed for their duties. Access is enforced by the system itself, not
          left to individual discretion.
        </p>
      </section>

      <section>
        <h2>5. Sharing with third parties</h2>
        <p>
          Payment records reference the bank accounts used to receive fees (e.g. NMB
          Bank, ZB Bank). We do not sell or share your data with advertisers or
          unrelated third parties. Data may be disclosed where required by Zimbabwean
          law or a lawful government request (e.g. MoPSE).
        </p>
      </section>

      <section>
        <h2>6. Data retention</h2>
        <p>
          Financial records (invoices, receipts, journal entries) are retained
          permanently as part of the school's audit trail, in line with standard
          financial record-keeping practice. Records are not deleted on request where
          doing so would break that audit trail.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>
          You may ask the school's Bursar to review or correct inaccurate personal
          details (e.g. a misspelled name or an outdated contact number). Core
          financial transaction records cannot be altered once posted, to preserve
          the integrity of the school's accounts.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>Questions about this policy or your data should be directed to the school's Bursar.</p>
      </section>
    </LegalPage>
  )
}
