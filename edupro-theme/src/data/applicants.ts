export type ApplicationStatus = 'Submitted' | 'Under Review' | 'Interview Scheduled' | 'Accepted' | 'Rejected' | 'Enrolled'

export interface ApplicantAcademicRecord {
  id: string
  year: string
  gradeOrForm: string
  schoolName: string
  result: string
}

export interface Applicant {
  id: string
  applicationNumber: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: 'Male' | 'Female'
  nationality: string
  desiredForm: string
  desiredIntakeYear: string
  applicationDate: string
  status: ApplicationStatus

  previousSchool: string
  previousSchoolAddress: string
  academicHistory: ApplicantAcademicRecord[]

  guardianName: string
  guardianRelationship: string
  guardianPhone: string
  guardianEmail: string
  guardianAddress: string
  guardianOccupation: string

  interviewDate: string
  interviewer: string
  interviewNotes: string
  decisionBy: string
  decisionDate: string
  decisionNotes: string
}

export const mockApplicants: Applicant[] = [
  {
    id: 'APP-2026-001',
    applicationNumber: 'ADM-APP-0231',
    firstName: 'Rufaro',
    lastName: 'Chiweshe',
    dateOfBirth: '2014-05-02',
    gender: 'Female',
    nationality: 'Zimbabwean',
    desiredForm: 'Form 1',
    desiredIntakeYear: '2027',
    applicationDate: '2026-08-12',
    status: 'Submitted',
    previousSchool: 'Mbare Primary School',
    previousSchoolAddress: 'Chikwanha Ave, Mbare, Harare',
    academicHistory: [
      { id: 'AH-1', year: '2025', gradeOrForm: 'Grade 6', schoolName: 'Mbare Primary School', result: 'Merit — 78% average' },
      { id: 'AH-2', year: '2024', gradeOrForm: 'Grade 5', schoolName: 'Mbare Primary School', result: 'Merit — 74% average' },
    ],
    guardianName: 'Netsai Chiweshe',
    guardianRelationship: 'Mother',
    guardianPhone: '+263 77 902 1145',
    guardianEmail: 'netsai.chiweshe@gmail.com',
    guardianAddress: '31 Chikwanha Avenue, Mbare, Harare',
    guardianOccupation: 'Seamstress',
    interviewDate: '',
    interviewer: '',
    interviewNotes: '',
    decisionBy: '',
    decisionDate: '',
    decisionNotes: '',
  },
  {
    id: 'APP-2026-002',
    applicationNumber: 'ADM-APP-0232',
    firstName: 'Nyasha',
    lastName: 'Madziva',
    dateOfBirth: '2014-09-19',
    gender: 'Male',
    nationality: 'Zimbabwean',
    desiredForm: 'Form 1',
    desiredIntakeYear: '2027',
    applicationDate: '2026-08-14',
    status: 'Under Review',
    previousSchool: 'Matapi Primary School',
    previousSchoolAddress: 'Matapi Flats, Mbare, Harare',
    academicHistory: [
      { id: 'AH-1', year: '2025', gradeOrForm: 'Grade 6', schoolName: 'Matapi Primary School', result: 'Distinction — 85% average' },
    ],
    guardianName: 'Kudakwashe Madziva',
    guardianRelationship: 'Father',
    guardianPhone: '+263 71 445 2290',
    guardianEmail: 'k.madziva@gmail.com',
    guardianAddress: '14 Matapi Flats, Mbare, Harare',
    guardianOccupation: 'Electrician',
    interviewDate: '',
    interviewer: '',
    interviewNotes: 'Strong academic record, checking sibling discipline history before scheduling interview.',
    decisionBy: '',
    decisionDate: '',
    decisionNotes: '',
  },
  {
    id: 'APP-2026-003',
    applicationNumber: 'ADM-APP-0233',
    firstName: 'Tapiwanashe',
    lastName: 'Gumbo',
    dateOfBirth: '2014-02-27',
    gender: 'Male',
    nationality: 'Zimbabwean',
    desiredForm: 'Form 1',
    desiredIntakeYear: '2027',
    applicationDate: '2026-07-30',
    status: 'Interview Scheduled',
    previousSchool: 'Glen View 3 Primary School',
    previousSchoolAddress: 'Glen View 3, Harare',
    academicHistory: [
      { id: 'AH-1', year: '2025', gradeOrForm: 'Grade 6', schoolName: 'Glen View 3 Primary School', result: 'Merit — 76% average' },
      { id: 'AH-2', year: '2024', gradeOrForm: 'Grade 5', schoolName: 'Glen View 3 Primary School', result: 'Merit — 71% average' },
    ],
    guardianName: 'Memory Gumbo',
    guardianRelationship: 'Mother',
    guardianPhone: '+263 78 667 3312',
    guardianEmail: 'memory.gumbo@gmail.com',
    guardianAddress: '77 Glen View 3, Harare',
    guardianOccupation: 'Vendor',
    interviewDate: '2026-09-22',
    interviewer: 'Dr. Simbarashe Moyana',
    interviewNotes: '',
    decisionBy: '',
    decisionDate: '',
    decisionNotes: '',
  },
  {
    id: 'APP-2026-004',
    applicationNumber: 'ADM-APP-0198',
    firstName: 'Ropafadzo',
    lastName: 'Mutasa',
    dateOfBirth: '2013-11-08',
    gender: 'Female',
    nationality: 'Zimbabwean',
    desiredForm: 'Form 2',
    desiredIntakeYear: '2027',
    applicationDate: '2026-06-15',
    status: 'Accepted',
    previousSchool: 'Highfield Secondary School',
    previousSchoolAddress: 'Highfield, Harare',
    academicHistory: [
      { id: 'AH-1', year: '2025', gradeOrForm: 'Form 1', schoolName: 'Highfield Secondary School', result: 'Distinction — 4 / 60' },
    ],
    guardianName: 'Tarisai Mutasa',
    guardianRelationship: 'Father',
    guardianPhone: '+263 77 221 6604',
    guardianEmail: 'tarisai.mutasa@gmail.com',
    guardianAddress: '9 Neshamba Street, Highfield, Harare',
    guardianOccupation: 'Bank Teller',
    interviewDate: '2026-07-02',
    interviewer: 'Dr. Simbarashe Moyana',
    interviewNotes: 'Confident, articulate, strong transfer references. Transferring due to relocation.',
    decisionBy: 'Dr. Simbarashe Moyana',
    decisionDate: '2026-07-05',
    decisionNotes: 'Accepted — place offered for Form 2, 2027 intake, subject to fee deposit.',
  },
  {
    id: 'APP-2026-005',
    applicationNumber: 'ADM-APP-0201',
    firstName: 'Kundai',
    lastName: 'Zishiri',
    dateOfBirth: '2014-04-30',
    gender: 'Male',
    nationality: 'Zimbabwean',
    desiredForm: 'Form 1',
    desiredIntakeYear: '2027',
    applicationDate: '2026-06-20',
    status: 'Rejected',
    previousSchool: 'Mufakose 2 Primary School',
    previousSchoolAddress: 'Mufakose, Harare',
    academicHistory: [
      { id: 'AH-1', year: '2025', gradeOrForm: 'Grade 6', schoolName: 'Mufakose 2 Primary School', result: 'Pass — 52% average' },
    ],
    guardianName: 'Patience Zishiri',
    guardianRelationship: 'Mother',
    guardianPhone: '+263 71 889 7723',
    guardianEmail: 'patience.zishiri@gmail.com',
    guardianAddress: '22 Willowvale Road, Mufakose, Harare',
    guardianOccupation: 'Domestic Worker',
    interviewDate: '2026-07-08',
    interviewer: 'Dr. Simbarashe Moyana',
    interviewNotes: 'Below the entry benchmark for the oversubscribed Form 1 2027 intake.',
    decisionBy: 'Dr. Simbarashe Moyana',
    decisionDate: '2026-07-10',
    decisionNotes: 'Not offered a place this intake — encouraged to reapply for the 2028 intake.',
  },
]
