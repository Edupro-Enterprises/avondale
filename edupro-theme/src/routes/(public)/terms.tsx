import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '@/features/legal/legal-page'

export const Route = createFileRoute('/(public)/terms')({
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPage title='Terms of Service' updated='17 September 2026'>
      <section>
        <p>
          These Terms of Service govern access to and use of this school's finance
          portal (the "Service"), operated on the Edupro SMS platform. By signing in,
          you agree to these terms on behalf of yourself and, where applicable, the
          school administration you represent.
        </p>
      </section>

      <section>
        <h2>1. Who can use this Service</h2>
        <p>
          Access is limited to authorised users -- Bursars, School Heads, School
          Development Committee (SDC) members, auditors, and parents/guardians or
          students with an active, school-issued account. Accounts are created and
          managed by the school's administration; there is no public self-registration.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>Keep your password confidential and do not share your login with anyone else.</li>
          <li>You are responsible for all activity recorded under your account.</li>
          <li>Notify the school's Bursar immediately if you suspect unauthorised access.</li>
        </ul>
      </section>

      <section>
        <h2>3. Financial records and accuracy</h2>
        <p>
          Fee structures, invoices, receipts, and payment records shown here are the
          school's official financial records. Bursars and other staff with write
          access must ensure entries are accurate and supported by real transactions.
          Parents/guardians and students see a read-only view of records concerning
          their own family.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Attempt to access another family's or student's records without authorisation.</li>
          <li>Interfere with the Service's normal operation or attempt to bypass its security controls.</li>
          <li>Use the Service to submit false financial information.</li>
        </ul>
      </section>

      <section>
        <h2>5. Service availability</h2>
        <p>
          The Service is provided on an "as available" basis. Scheduled maintenance
          or unplanned outages may occur; the school will use reasonable efforts to
          keep any planned downtime brief and to communicate it in advance where practical.
        </p>
      </section>

      <section>
        <h2>6. Changes to these terms</h2>
        <p>
          These terms may be updated from time to time to reflect changes in how the
          Service operates. Continued use of the Service after an update constitutes
          acceptance of the revised terms.
        </p>
      </section>

      <section>
        <h2>7. Governing law</h2>
        <p>These terms are governed by the laws of Zimbabwe.</p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>Questions about these terms should be directed to the school's Bursar.</p>
      </section>
    </LegalPage>
  )
}
