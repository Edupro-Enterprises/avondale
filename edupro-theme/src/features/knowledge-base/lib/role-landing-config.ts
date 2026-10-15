import type { KbRole } from '@/features/knowledge-base/types/kb'

/** Copy for each role's KB landing page -- data, not hardcoded org content,
 * kept separate from the route component so a wording change never touches
 * rendering logic. "mopse" intentionally has its own entry distinct from
 * "auditor" even though both currently map to the same backend role (see
 * kb.ts's KB_ROLES comment) -- their reading lists differ. */
export const KB_ROLE_LANDING_COPY: Record<KbRole, { title: string; description: string }> = {
  parent: {
    title: 'For Parents & Guardians',
    description: 'Understanding fees, payments, and how your school manages its finances.',
  },
  sdc: {
    title: 'For SDC Members',
    description: 'Governance, budgeting, and oversight guidance for School Development Committees.',
  },
  bursar: {
    title: 'For Bursars',
    description: 'Day-to-day financial management: receipting, banking, payroll, and reporting.',
  },
  head: {
    title: 'For School Heads',
    description: 'Approvals, oversight, and your responsibilities under the regulations.',
  },
  auditor: {
    title: 'For District Auditors',
    description: 'Audit trails, controls, and what to check during a school financial review.',
  },
  mopse: {
    title: 'For MoPSE Officers',
    description: 'Ministry reporting requirements and compliance guidance for schools.',
  },
  student: {
    title: 'For Students',
    description: 'What school fees pay for, and how the SDC represents your interests.',
  },
  public: {
    title: 'Public Guidance',
    description: 'General financial-management guidance, open to anyone.',
  },
}
