export type EnrollmentStatus = 'Active' | 'Suspended' | 'Withdrawn' | 'Graduated' | 'Transferred'
export type LunchScheme = 'Day Scholar — No Lunch' | 'Day Scholar — Lunch' | 'Boarder — Full Board'

export interface CoreIdentity {
  dateOfBirth: string
  gender: 'Male' | 'Female'
  nationalIdOrBirthCert: string
  nationality: string
  admissionNumber: string
  previousSchool: string
}

export interface LifecycleStatus {
  enrollmentStatus: EnrollmentStatus
  transferDate: string
  transferReason: string
}

export interface Placement {
  boardingHouseId: string
  dormitoryRoomId: string
  busRouteId: string
  lunchScheme: LunchScheme
}

export interface FundingDetail {
  beamApplicationNumber: string
  beamCoveragePercent: number
  scholarshipSponsor: string
  scholarshipCoveragePercent: number
  staffLinkEmployeeNumber: string
  staffDiscountPercent: number
}

export interface EmergencyContact {
  id: string
  name: string
  relationship: string
  phone: string
}

export interface MedicalInfo {
  chronicConditions: string
  allergies: string[]
  medications: string[]
  emergencyContacts: EmergencyContact[]
  medicalAidProvider: string
  medicalAidNumber: string
  consentToTreat: boolean
}

export interface SenInfo {
  hasSEN: boolean
  category: string
  supportPlan: string
  reviewDate: string
}

export interface DisciplinaryRecord {
  id: string
  date: string
  incident: string
  actionTaken: string
}

export interface AcademicHistoryEntry {
  id: string
  year: string
  form: string
  finalPosition: string
  promoted: boolean
}

export interface AttendanceSummary {
  termDaysPresent: number
  termDaysAbsent: number
  termDaysLate: number
}

export interface ExtracurricularActivity {
  id: string
  name: string
  role: string
}

export interface LibraryItem {
  id: string
  title: string
  checkedOutDate: string
  dueDate: string
}

export interface StudentDocument {
  id: string
  name: string
  uploaded: boolean
  uploadedDate: string
}

export interface AuditMeta {
  recordCreatedDate: string
  recordCreatedBy: string
  lastModifiedDate: string
  lastModifiedBy: string
  portalAccessEnabled: boolean
}

export interface StudentProfile {
  studentId: string
  coreIdentity: CoreIdentity
  lifecycle: LifecycleStatus
  placement: Placement
  funding: FundingDetail
  medical: MedicalInfo
  sen: SenInfo
  disciplinaryRecords: DisciplinaryRecord[]
  academicHistory: AcademicHistoryEntry[]
  attendance: AttendanceSummary
  extracurricular: ExtracurricularActivity[]
  library: LibraryItem[]
  documents: StudentDocument[]
  audit: AuditMeta
}

const standardDocuments = (): StudentDocument[] => [
  { id: 'DOC-1', name: 'Birth Certificate', uploaded: true, uploadedDate: '2024-01-10' },
  { id: 'DOC-2', name: 'Immunization Record', uploaded: true, uploadedDate: '2024-01-10' },
  { id: 'DOC-3', name: 'Previous School Report', uploaded: false, uploadedDate: '' },
]

export const mockStudentProfiles: Record<string, StudentProfile> = {
  'STU-2026-001': {
    studentId: 'STU-2026-001',
    coreIdentity: {
      dateOfBirth: '2012-03-18',
      gender: 'Male',
      nationalIdOrBirthCert: 'BC-0441122',
      nationality: 'Zimbabwean',
      admissionNumber: 'ADM-2024-014',
      previousSchool: 'Mbare Primary School',
    },
    lifecycle: { enrollmentStatus: 'Active', transferDate: '', transferReason: '' },
    placement: { boardingHouseId: '', dormitoryRoomId: '', busRouteId: 'BR-01', lunchScheme: 'Day Scholar — Lunch' },
    funding: { beamApplicationNumber: '', beamCoveragePercent: 0, scholarshipSponsor: '', scholarshipCoveragePercent: 0, staffLinkEmployeeNumber: '', staffDiscountPercent: 0 },
    medical: {
      chronicConditions: 'Mild asthma',
      allergies: ['Peanuts'],
      medications: ['Salbutamol inhaler (as needed)'],
      emergencyContacts: [
        { id: 'EC-1', name: 'Tadiwa Moyo Sr.', relationship: 'Father', phone: '+263 77 123 4567' },
        { id: 'EC-2', name: 'Grace Moyo', relationship: 'Mother', phone: '+263 71 987 6543' },
      ],
      medicalAidProvider: 'CIMAS',
      medicalAidNumber: 'CIM-88213',
      consentToTreat: true,
    },
    sen: { hasSEN: true, category: 'Mild dyslexia', supportPlan: 'Extra time in written assessments; preferential seating', reviewDate: '2026-11-01' },
    disciplinaryRecords: [
      { id: 'DR-1', date: '2026-03-02', incident: 'Late to class (3rd occurrence)', actionTaken: 'Verbal warning, noted by Form Teacher' },
    ],
    academicHistory: [
      { id: 'AH-1', year: '2024', form: 'Form 1A', finalPosition: '12 / 45', promoted: true },
      { id: 'AH-2', year: '2025', form: 'Form 1C', finalPosition: '8 / 45', promoted: true },
    ],
    attendance: { termDaysPresent: 54, termDaysAbsent: 2, termDaysLate: 3 },
    extracurricular: [
      { id: 'EX-1', name: 'Football Club', role: 'Player' },
      { id: 'EX-2', name: 'Debate Society', role: 'Member' },
    ],
    library: [{ id: 'LIB-1', title: 'Things Fall Apart', checkedOutDate: '2026-08-20', dueDate: '2026-09-20' }],
    documents: standardDocuments(),
    audit: { recordCreatedDate: '2024-01-15', recordCreatedBy: 'Tendai Marufu', lastModifiedDate: '2026-08-28', lastModifiedBy: 'Tendai Marufu', portalAccessEnabled: true },
  },
  'STU-2026-002': {
    studentId: 'STU-2026-002',
    coreIdentity: { dateOfBirth: '2010-07-02', gender: 'Female', nationalIdOrBirthCert: 'BC-0339981', nationality: 'Zimbabwean', admissionNumber: 'ADM-2022-031', previousSchool: 'Glen View Primary School' },
    lifecycle: { enrollmentStatus: 'Active', transferDate: '', transferReason: '' },
    placement: { boardingHouseId: '', dormitoryRoomId: '', busRouteId: 'BR-01', lunchScheme: 'Day Scholar — No Lunch' },
    funding: { beamApplicationNumber: '', beamCoveragePercent: 0, scholarshipSponsor: '', scholarshipCoveragePercent: 0, staffLinkEmployeeNumber: '', staffDiscountPercent: 0 },
    medical: { chronicConditions: 'None', allergies: [], medications: [], emergencyContacts: [{ id: 'EC-1', name: 'Farai Chikafu', relationship: 'Father', phone: '+263 77 234 5678' }], medicalAidProvider: '', medicalAidNumber: '', consentToTreat: true },
    sen: { hasSEN: false, category: '', supportPlan: '', reviewDate: '' },
    disciplinaryRecords: [],
    academicHistory: [
      { id: 'AH-1', year: '2025', form: 'Form 4A', finalPosition: '3 / 40', promoted: true },
    ],
    attendance: { termDaysPresent: 58, termDaysAbsent: 0, termDaysLate: 1 },
    extracurricular: [{ id: 'EX-1', name: 'Science Club', role: 'Vice Chair' }],
    library: [],
    documents: standardDocuments(),
    audit: { recordCreatedDate: '2022-01-10', recordCreatedBy: 'Tendai Marufu', lastModifiedDate: '2026-08-15', lastModifiedBy: 'Tendai Marufu', portalAccessEnabled: false },
  },
  'STU-2026-003': {
    studentId: 'STU-2026-003',
    coreIdentity: { dateOfBirth: '2013-11-24', gender: 'Male', nationalIdOrBirthCert: 'BC-0552210', nationality: 'Zimbabwean', admissionNumber: 'ADM-2026-002', previousSchool: 'Matapi Primary School' },
    lifecycle: { enrollmentStatus: 'Active', transferDate: '', transferReason: '' },
    placement: { boardingHouseId: '', dormitoryRoomId: '', busRouteId: '', lunchScheme: 'Day Scholar — No Lunch' },
    funding: { beamApplicationNumber: 'BEAM-2026-0417', beamCoveragePercent: 100, scholarshipSponsor: '', scholarshipCoveragePercent: 0, staffLinkEmployeeNumber: '', staffDiscountPercent: 0 },
    medical: { chronicConditions: 'None', allergies: [], medications: [], emergencyContacts: [{ id: 'EC-1', name: 'Chipo Mavhunga', relationship: 'Mother', phone: '+263 71 345 6789' }], medicalAidProvider: '', medicalAidNumber: '', consentToTreat: true },
    sen: { hasSEN: false, category: '', supportPlan: '', reviewDate: '' },
    disciplinaryRecords: [],
    academicHistory: [{ id: 'AH-1', year: '2026', form: 'Form 1C', finalPosition: 'Not yet assessed', promoted: false }],
    attendance: { termDaysPresent: 40, termDaysAbsent: 1, termDaysLate: 0 },
    extracurricular: [],
    library: [],
    documents: standardDocuments(),
    audit: { recordCreatedDate: '2026-01-20', recordCreatedBy: 'Tendai Marufu', lastModifiedDate: '2026-01-20', lastModifiedBy: 'Tendai Marufu', portalAccessEnabled: true },
  },
  'STU-2026-004': {
    studentId: 'STU-2026-004',
    coreIdentity: { dateOfBirth: '2008-05-09', gender: 'Male', nationalIdOrBirthCert: 'BC-0219981', nationality: 'Zimbabwean', admissionNumber: 'ADM-2020-007', previousSchool: 'Highfield Primary School' },
    lifecycle: { enrollmentStatus: 'Active', transferDate: '', transferReason: '' },
    placement: { boardingHouseId: 'BH-02', dormitoryRoomId: 'DR-03', busRouteId: '', lunchScheme: 'Boarder — Full Board' },
    funding: { beamApplicationNumber: '', beamCoveragePercent: 0, scholarshipSponsor: 'Old Boys Trust Fund', scholarshipCoveragePercent: 75, staffLinkEmployeeNumber: '', staffDiscountPercent: 0 },
    medical: { chronicConditions: 'None', allergies: ['Penicillin'], medications: [], emergencyContacts: [{ id: 'EC-1', name: 'Rumbidzai Museva', relationship: 'Mother', phone: '+263 78 456 7890' }], medicalAidProvider: 'PSMAS', medicalAidNumber: 'PSM-11209', consentToTreat: true },
    sen: { hasSEN: false, category: '', supportPlan: '', reviewDate: '' },
    disciplinaryRecords: [
      { id: 'DR-1', date: '2025-06-14', incident: 'Out of bounds after lights-out', actionTaken: 'Weekend detention, House Master notified' },
    ],
    academicHistory: [
      { id: 'AH-1', year: '2023', form: 'Form 4A', finalPosition: '5 / 42', promoted: true },
      { id: 'AH-2', year: '2024', form: 'Form 5A', finalPosition: '2 / 38', promoted: true },
      { id: 'AH-3', year: '2025', form: 'Form 6A', finalPosition: '1 / 30', promoted: true },
    ],
    attendance: { termDaysPresent: 59, termDaysAbsent: 1, termDaysLate: 0 },
    extracurricular: [
      { id: 'EX-1', name: 'Prefect Body', role: 'Head Boy' },
      { id: 'EX-2', name: 'Chess Club', role: 'Captain' },
    ],
    library: [{ id: 'LIB-1', title: "A Level Pure Mathematics", checkedOutDate: '2026-08-01', dueDate: '2026-09-01' }],
    documents: standardDocuments(),
    audit: { recordCreatedDate: '2020-01-12', recordCreatedBy: 'Tendai Marufu', lastModifiedDate: '2026-06-20', lastModifiedBy: 'Tendai Marufu', portalAccessEnabled: true },
  },
  'STU-2026-005': {
    studentId: 'STU-2026-005',
    coreIdentity: { dateOfBirth: '2011-09-30', gender: 'Male', nationalIdOrBirthCert: 'BC-0668820', nationality: 'Zimbabwean', admissionNumber: 'ADM-2023-019', previousSchool: 'Mbare Primary School' },
    lifecycle: { enrollmentStatus: 'Active', transferDate: '', transferReason: '' },
    placement: { boardingHouseId: '', dormitoryRoomId: '', busRouteId: '', lunchScheme: 'Day Scholar — Lunch' },
    funding: { beamApplicationNumber: '', beamCoveragePercent: 0, scholarshipSponsor: '', scholarshipCoveragePercent: 0, staffLinkEmployeeNumber: 'EMP-0071', staffDiscountPercent: 50 },
    medical: { chronicConditions: 'None', allergies: [], medications: [], emergencyContacts: [{ id: 'EC-1', name: 'Simbarashe Gwaze', relationship: 'Father', phone: '+263 77 567 8901' }], medicalAidProvider: '', medicalAidNumber: '', consentToTreat: true },
    sen: { hasSEN: false, category: '', supportPlan: '', reviewDate: '' },
    disciplinaryRecords: [],
    academicHistory: [{ id: 'AH-1', year: '2025', form: 'Form 3A', finalPosition: '15 / 44', promoted: true }],
    attendance: { termDaysPresent: 60, termDaysAbsent: 0, termDaysLate: 0 },
    extracurricular: [{ id: 'EX-1', name: 'Athletics', role: 'Member' }],
    library: [],
    documents: standardDocuments(),
    audit: { recordCreatedDate: '2023-01-16', recordCreatedBy: 'Tendai Marufu', lastModifiedDate: '2026-07-10', lastModifiedBy: 'Tendai Marufu', portalAccessEnabled: false },
  },
  'STU-2026-006': {
    studentId: 'STU-2026-006',
    coreIdentity: { dateOfBirth: '2012-01-22', gender: 'Female', nationalIdOrBirthCert: 'BC-0771102', nationality: 'Zimbabwean', admissionNumber: 'ADM-2024-018', previousSchool: 'Glen Norah Primary School' },
    lifecycle: { enrollmentStatus: 'Active', transferDate: '', transferReason: '' },
    placement: { boardingHouseId: '', dormitoryRoomId: '', busRouteId: 'BR-02', lunchScheme: 'Day Scholar — No Lunch' },
    funding: { beamApplicationNumber: '', beamCoveragePercent: 0, scholarshipSponsor: '', scholarshipCoveragePercent: 0, staffLinkEmployeeNumber: '', staffDiscountPercent: 0 },
    medical: { chronicConditions: 'None', allergies: [], medications: [], emergencyContacts: [{ id: 'EC-1', name: 'Tafadzwa Chirwa', relationship: 'Father', phone: '+263 71 678 9012' }], medicalAidProvider: '', medicalAidNumber: '', consentToTreat: true },
    sen: { hasSEN: false, category: '', supportPlan: '', reviewDate: '' },
    disciplinaryRecords: [],
    academicHistory: [{ id: 'AH-1', year: '2025', form: 'Form 1A', finalPosition: '20 / 45', promoted: true }],
    attendance: { termDaysPresent: 56, termDaysAbsent: 3, termDaysLate: 1 },
    extracurricular: [],
    library: [],
    documents: standardDocuments(),
    audit: { recordCreatedDate: '2024-01-15', recordCreatedBy: 'Tendai Marufu', lastModifiedDate: '2026-08-01', lastModifiedBy: 'Tendai Marufu', portalAccessEnabled: false },
  },
  'STU-2026-007': {
    studentId: 'STU-2026-007',
    coreIdentity: { dateOfBirth: '2009-02-14', gender: 'Female', nationalIdOrBirthCert: 'BC-0114409', nationality: 'Zimbabwean', admissionNumber: 'ADM-2021-011', previousSchool: 'Mufakose Primary School' },
    lifecycle: { enrollmentStatus: 'Active', transferDate: '', transferReason: '' },
    placement: { boardingHouseId: 'BH-01', dormitoryRoomId: 'DR-01', busRouteId: '', lunchScheme: 'Boarder — Full Board' },
    funding: { beamApplicationNumber: '', beamCoveragePercent: 0, scholarshipSponsor: '', scholarshipCoveragePercent: 0, staffLinkEmployeeNumber: '', staffDiscountPercent: 0 },
    medical: { chronicConditions: 'Mild eczema', allergies: [], medications: ['Hydrocortisone cream'], emergencyContacts: [{ id: 'EC-1', name: 'Blessing Sithole', relationship: 'Father', phone: '+263 78 789 0123' }], medicalAidProvider: 'First Mutual', medicalAidNumber: 'FM-33210', consentToTreat: true },
    sen: { hasSEN: false, category: '', supportPlan: '', reviewDate: '' },
    disciplinaryRecords: [],
    academicHistory: [
      { id: 'AH-1', year: '2024', form: 'Form 4B', finalPosition: '9 / 38', promoted: true },
      { id: 'AH-2', year: '2025', form: 'Form 5B', finalPosition: '6 / 35', promoted: true },
    ],
    attendance: { termDaysPresent: 57, termDaysAbsent: 2, termDaysLate: 1 },
    extracurricular: [{ id: 'EX-1', name: 'Netball', role: 'Team Captain' }],
    library: [{ id: 'LIB-1', title: 'O Level Combined Science', checkedOutDate: '2026-08-15', dueDate: '2026-09-15' }],
    documents: standardDocuments(),
    audit: { recordCreatedDate: '2021-01-11', recordCreatedBy: 'Tendai Marufu', lastModifiedDate: '2026-08-05', lastModifiedBy: 'Tendai Marufu', portalAccessEnabled: true },
  },
  'STU-2026-008': {
    studentId: 'STU-2026-008',
    coreIdentity: { dateOfBirth: '2014-06-06', gender: 'Female', nationalIdOrBirthCert: 'BC-0881123', nationality: 'Zimbabwean', admissionNumber: 'ADM-2026-005', previousSchool: 'Mbare Primary School' },
    lifecycle: { enrollmentStatus: 'Active', transferDate: '', transferReason: '' },
    placement: { boardingHouseId: '', dormitoryRoomId: '', busRouteId: '', lunchScheme: 'Day Scholar — No Lunch' },
    funding: { beamApplicationNumber: 'BEAM-2026-0512', beamCoveragePercent: 100, scholarshipSponsor: '', scholarshipCoveragePercent: 0, staffLinkEmployeeNumber: '', staffDiscountPercent: 0 },
    medical: { chronicConditions: 'None', allergies: [], medications: [], emergencyContacts: [{ id: 'EC-1', name: 'Memory Nyathi', relationship: 'Mother', phone: '+263 77 890 1234' }], medicalAidProvider: '', medicalAidNumber: '', consentToTreat: true },
    sen: { hasSEN: false, category: '', supportPlan: '', reviewDate: '' },
    disciplinaryRecords: [],
    academicHistory: [{ id: 'AH-1', year: '2026', form: 'Form 1A', finalPosition: 'Not yet assessed', promoted: false }],
    attendance: { termDaysPresent: 38, termDaysAbsent: 3, termDaysLate: 0 },
    extracurricular: [],
    library: [],
    documents: standardDocuments(),
    audit: { recordCreatedDate: '2026-01-20', recordCreatedBy: 'Tendai Marufu', lastModifiedDate: '2026-01-20', lastModifiedBy: 'Tendai Marufu', portalAccessEnabled: false },
  },
}

export function getStudentProfile(studentId: string): StudentProfile {
  return mockStudentProfiles[studentId]
}
