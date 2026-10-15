export type SchoolType = 'Government' | 'Council' | 'Mission' | 'Private' | 'Trust'
export type ResponsibleAuthority = 'Ministry' | 'Council' | 'Church' | 'Private Trust' | 'Board'
export type SchoolLevel = 'ECD' | 'Primary' | 'Secondary' | 'Combined'
export type GenderPolicy = 'Boys' | 'Girls' | 'Mixed'
export type BoardingStatus = 'Day Only' | 'Boarding Only' | 'Day & Boarding'
export type TermStructure = '3 Terms' | '2 Semesters'

export interface SchoolProfile {
  // Identity
  schoolName: string
  shortName: string
  registrationNumber: string
  emisNumber: string
  admissionFolioNumber: string
  schoolType: SchoolType
  responsibleAuthority: ResponsibleAuthority
  schoolClassification: string
  schoolLevel: SchoolLevel
  genderPolicy: GenderPolicy
  boardingStatus: BoardingStatus
  motto: string
  yearEstablished: string

  // Location
  physicalAddress: string
  suburb: string
  district: string
  province: string
  region: string
  wardNumber: string
  gpsCoordinates: string
  postalAddress: string

  // Contact
  mainPhone: string
  alternatePhone: string
  whatsappNumber: string
  officialEmail: string
  financeEmail: string
  headOfficeEmail: string
  website: string

  // Compliance
  bankAccountNameLegal: string
  zimraBpNumber: string
  nssaNumber: string
  prazNumber: string
  auditFirmName: string
  auditFirmContact: string

  // Financial configuration
  financialYearStart: string
  financialYearEnd: string
  termStructure: TermStructure
  feeApprovalAuthority: string

  // Localization
  weekStartDay: 'Monday' | 'Sunday'
  timeZone: string
  language: 'English' | 'Shona' | 'Ndebele'
  dateFormat: string

  // Document templates
  receiptHeaderText: string
  receiptFooterText: string
  statementHeaderText: string
  statementFooterText: string
  invoiceTerms: string
  paymentInstructions: string

  // Setup meta
  setupCompleted: boolean
  setupCompletedDate: string
  setupCompletedBy: string
}

export const defaultSchoolProfile: SchoolProfile = {
  schoolName: 'Avondale Primary School',
  shortName: 'MHS',
  registrationNumber: 'MOPSE-HRE-4471',
  emisNumber: '1234567890',
  admissionFolioNumber: '',
  schoolType: 'Government',
  responsibleAuthority: 'Ministry',
  schoolClassification: 'S2',
  schoolLevel: 'Secondary',
  genderPolicy: 'Mixed',
  boardingStatus: 'Day & Boarding',
  motto: 'Knowledge for Service',
  yearEstablished: '1968',

  physicalAddress: '12 Chishawasha Road',
  suburb: 'Mbare',
  district: 'Harare',
  province: 'Harare Metropolitan',
  region: 'Central',
  wardNumber: '20',
  gpsCoordinates: '-17.8451, 31.0231',
  postalAddress: 'P.O. Box MB 44, Mbare, Harare',

  mainPhone: '+263 24 277 1122',
  alternatePhone: '',
  whatsappNumber: '+263 77 123 4567',
  officialEmail: 'info@mbarehigh.edu.zw',
  financeEmail: 'bursar@mbarehigh.edu.zw',
  headOfficeEmail: '',
  website: 'https://mbarehigh.edu.zw',

  bankAccountNameLegal: 'Avondale Primary School',
  zimraBpNumber: '',
  nssaNumber: '',
  prazNumber: '',
  auditFirmName: '',
  auditFirmContact: '',

  financialYearStart: '2026-01-01',
  financialYearEnd: '2026-12-31',
  termStructure: '3 Terms',
  feeApprovalAuthority: 'MoPSE / SDC',

  weekStartDay: 'Monday',
  timeZone: 'Africa/Harare',
  language: 'English',
  dateFormat: 'DD/MM/YYYY',

  receiptHeaderText: '',
  receiptFooterText: 'Thank you for your prompt payment.',
  statementHeaderText: '',
  statementFooterText: '',
  invoiceTerms: 'Payment due within 14 days of invoice date.',
  paymentInstructions: 'EcoCash Merchant *151*2*4*8899# or bank transfer to CBZ Bank — General Account, CBZ-4471-002.',

  setupCompleted: true,
  setupCompletedDate: '2026-01-05',
  setupCompletedBy: 'Tendai Marufu',
}
