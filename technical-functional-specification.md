# System Requirements & Functional Specification

## Edupro School Fees & Financial Statement System

---

### Document Control

| **Attribute** | **Value** |
|---|---|
| Project Name | Edupro School Fees & Financial Statement System |
| Document Type | System Requirements & Functional Specification (Final) |
| Version | 2.0 |
| Date | 2026-09-09 |
| Author | Product/Business Analysis Team |
| Owner | Edupro Enterprises |
| Status | **FINAL - Ready for Development** |
| Distribution | Development Team, QA Team, Project Management, Stakeholders |

---

## Clarification Questions & Responses

Before presenting the final specification, the following clarifications were addressed:

### Q1: Offline Receipt Sync - Conflict Resolution Strategy

**Question:** When a cashier issues receipts offline and later syncs, what is the exact conflict resolution strategy for duplicate or conflicting receipt numbers? Also, what happens if two cashiers issue receipts offline simultaneously for the same student?

**Response:** Offline receipts will use a UUID-based temporary receipt number (format: OFF-{Timestamp}-{CashierID}-{Sequence}) which is replaced by a system-generated sequential number upon sync. If two offline receipts exist for the same student, the sync process will flag them for manual review by the senior bursar. The system will use a "last write wins" strategy only for metadata fields, while transaction amounts and receipt lines remain immutable and require manual reconciliation. The first receipt synced retains its temporary number until manual resolution, and the second is quarantined.

### Q2: Multi-School Support

**Question:** Is this system intended for a single school or multiple schools? The specification mentions both "school" and "multi-school deployments."

**Response:** The system is designed as a **single-tenant, single-school** deployment per instance. Each installation serves one school entity. However, the architecture allows a hosting provider to spin up multiple isolated instances for different schools using Frappe's multi-tenancy capabilities. Each instance has its own database, configuration, and data. There is no cross-school data sharing or centralized multi-school reporting in the base product.

### Q3: Currency Exchange Rate Strategy

**Question:** For reporting purposes, how are dual-currency financial statements consolidated? Is there a daily exchange rate or a fixed period-end rate?

**Response:** The system will use a **period-end rate** for statutory reporting purposes. The Bursar will manually enter the RBZ-published exchange rate at the end of each reporting period (monthly, termly, and annually). This rate is used for:
- Consolidated financial statements (USD presentation with ZiG converted)
- MoPSE ED46 returns
- Audit reports

The system will maintain a historical exchange rate table with effective dates. All transaction reporting uses the rate applicable on the transaction date for operational reports, while statutory reports use the period-end rate mandated by the specific reporting framework.

### Q4: BEAM Funding Integration

**Question:** How does the system handle BEAM claims and reconciliation with the Ministry of Social Welfare? Is there an API or manual file upload?

**Response:** The system will support **manual upload** of BEAM disbursement files from Treasury. The Bursar will import the CSV/Excel file containing BEAM payments, which will auto-match against student BEAM obligations. The system will generate the BEAM Claims & Disbursement Reconciliation Statement (Section 7.7) and flag discrepancies for follow-up. No direct API integration with Ministry systems is available in this phase.

### Q5: Payment Gateway Integration

**Question:** Which specific payment gateways are supported for online parent payments?

**Response:** Phase 1 deployment supports **EcoCash** (via EcoCash Merchant API) and **bank transfers**. Credit/debit card payments (Visa/Mastercard) via Paynow, ZimSwitch, or direct acquiring banks are deferred to Phase 2. The architecture is designed to accommodate additional gateways through a payment adapter interface. For Phase 1, parent online payments will primarily be via:
1. EcoCash (direct USSD/App API integration)
2. Bank transfer (manual reconciliation with reference matching)

### Q6: Document Storage and Retention

**Question:** How long are documents (receipts, approval letters, AGM minutes) retained? What is the storage architecture?

**Response:** Documents are retained **indefinitely** for audit compliance. Frappe's File Manager stores documents in the file system (production: S3-compatible or local volumes) with metadata in the database. Retention policy is:
- Financial records: 7+ years (per PFMA and audit requirements)
- Student records: Life of student + 5 years
- Procurement records: 5+ years
- Approval documents: Life of related fee structure + 5 years

All documents are hashed for integrity verification and stored with metadata (uploader, date, document type, related transaction ID).

### Q7: Parent Portal Access

**Question:** Can parents register their own accounts, or are they created by the school?

**Response:** Parents will receive an **invitation email/SMS** from the school with a secure registration link. The system generates a unique registration token tied to the parent's contact details. Parents cannot self-register without an invitation to ensure proper student-parent linkage. Once registered, parents can:
- View statements
- Make payments (EcoCash integration)
- Download receipts
- View payment plan agreements

### Q8: Reporting Output Formats

**Question:** What specific file formats are required for each report type?

**Response:** 

| **Report Type** | **Required Formats** |
|---|---|
| MoPSE ED46 / ED46B | PDF (signed), Excel, CSV |
| BEAM Reconciliation | Excel, PDF |
| AGM Financial Pack | PDF (professional layout) |
| Bank Reconciliation | PDF, Excel |
| Auditor's Pack | PDF (export all), JSON (for audit software) |
| Receipts | PDF (email/print), HTML (portal view) |
| Management Reports | Excel, PDF |
| Export to Accounting Software | JSON, Excel |

### Q9: System Notification Channels

**Question:** Beyond SMS and email, are WhatsApp notifications required for all events?

**Response:** The priority channels are:
1. **Email** (primary, includes PDF attachments)
2. **SMS** (critical events: payment confirmation, overdue reminders, approval alerts)
3. **WhatsApp** (optional, via WhatsApp Business API - to be configured on a per-school basis)

Default: Email and SMS are mandatory; WhatsApp is configurable.

### Q10: Data Backup and Disaster Recovery

**Question:** What is the backup strategy and RPO/RTO?

**Response:** 
- **Daily automated backups** (full database + file system) stored in a separate geographic location
- **RPO (Recovery Point Objective)**: 24 hours (daily backup)
- **RTO (Recovery Time Objective)**: 4 hours for full restoration
- **Backup retention**: 30 days (daily), 12 months (monthly), 7 years (annual)
- **Frappe Cloud** provides managed backups as part of the hosting service

---

## Final System Requirements & Functional Specification

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete system requirements and functional specifications for the **Edupro School Fees & Financial Statement System**, a comprehensive financial management platform for Zimbabwean schools. It serves as the definitive reference for the development team, QA engineers, project managers, and stakeholders throughout the implementation lifecycle.

### 1.2 Scope

The system manages the complete school finance lifecycle:
- Fee structure approval and activation
- Student billing and invoicing
- Multi-currency receipting and payment processing
- Debtor management and payment plans
- Procurement, expenditure control, and budget tracking
- General ledger, cashbook, and financial reporting
- Statutory reporting for MoPSE, SDC, and external auditors
- Parent/guardian communication and portal access
- Offline-capable cash office operations

### 1.3 Definitions and Acronyms

| **Term** | **Definition** |
|---|---|
| AGM | Annual General Meeting (SDC parent meeting) |
| AOD | Acknowledgment of Debt |
| BEAM | Basic Education Assistance Module |
| DEO | District Education Officer |
| EMIS | Education Management Information System |
| FCA | Foreign Currency Account |
| IPSAS | International Public Sector Accounting Standards |
| MoPSE | Ministry of Primary and Secondary Education |
| PFMA | Public Finance Management Act |
| POS | Point of Sale |
| PRAZ | Procurement Regulatory Authority of Zimbabwe |
| PV | Payment Voucher |
| RBZ | Reserve Bank of Zimbabwe |
| SDC | School Development Committee |
| SIG | School Improvement Grant |
| ZiG | Zimbabwe Gold (local currency) |

### 1.4 Intended Audience

This document is intended for:
- **Development Team**: System architecture, coding, and implementation
- **QA Team**: Test planning, execution, and validation
- **Project Management**: Tracking and delivery oversight
- **Stakeholders**: Business owners, school leadership, and investors

---

## 2. Technology Stack

### 2.1 Core Stack

| **Layer** | **Technology** | **Version** |
|---|---|---|
| Framework | Frappe Framework | v16 (production), v15 (local dev) |
| Database | MariaDB | 10.6+ |
| Cache / Queue | Redis + RQ | Latest stable |
| Language | Python (backend) | 3.10+ |
| Language | JavaScript (frontend) | ES6+ |
| PDF Rendering | wkhtmltopdf | Latest stable |
| Frontend | Frappe Desk + Web Pages | Built-in |
| Hosting (Production) | Frappe Cloud | N/A |
| Hosting (Dev) | Docker Desktop + frappe_docker | Latest |
| App Structure | Custom Frappe App | edupro_school_fees |

### 2.2 Application Architecture Pattern

```
edupro_school_fees/
├── __init__.py
├── hooks.py
├── modules.txt
├── patches.txt
├── public/
│   ├── css/
│   ├── js/
│   └── images/
├── edupro_school_fees/
│   ├── doctype/
│   │   ├── school_setup/
│   │   ├── student/
│   │   ├── fee_structure/
│   │   ├── invoice/
│   │   ├── receipt/
│   │   ├── payment_voucher/
│   │   ├── requisition/
│   │   ├── journal_entry/
│   │   ├── budget_vote/
│   │   ├── debtor_case/
│   │   ├── payment_plan/
│   │   ├── asset_register/
│   │   ├── bank_reconciliation/
│   │   └── communication_log/
│   ├── reports/
│   ├── print_formats/
│   ├── workflows/
│   └── portal/
├── fixtures/
│   ├── roles.json
│   ├── workflow.json
│   └── custom_fields.json
├── requirements.txt
└── setup.py
```

### 2.3 Hosting Environment

- **Production**: Frappe Cloud (managed hosting)
- **Staging**: Frappe Cloud (separate site)
- **Development**: Docker Desktop + frappe_docker
- **Database**: MariaDB (managed by Frappe Cloud)
- **Storage**: S3-compatible or local volumes (Frappe Cloud managed)
- **Backups**: Automated daily, 30-day retention

---

## 3. Regulatory and Compliance Framework

### 3.1 Applicable Legislation

The system must comply with the following legal instruments:

| **Instrument** | **Key Provisions** |
|---|---|
| Education Act [Chapter 25:04] | Fee structures, learner rights, parent communication |
| Statutory Instrument 1 of 2000 | School leadership accountability, asset management |
| Statutory Instrument 87 of 1992 | SDC governance, financial boundaries |
| Public Finance Management Act [Chapter 22:19] | Accounting controls, public funds stewardship |
| Procurement and Public Assets Disposal Act | Procurement thresholds, disposal procedures |
| RBZ Exchange Control Guidelines | Dual-currency handling, account mapping |

### 3.2 Mandatory Compliance Rules

The system must enforce:

1. **No learner may be denied class or exam access** due to fee arrears.
2. **Parent/guardian communication** restricted to authorized contact channels.
3. **No public defaulters lists** or naming-and-shaming of learners.
4. **Fee structures require approval evidence** before activation.
5. **Receipts are immutable**; only approved reversals/credit notes allowed.
6. **Dual-signature authorization** for sensitive procurement and payments.
7. **All financial reports exportable** in MoPSE and audit-accepted formats.

---

## 4. Functional Requirements

### 4.1 Setup, Governance, and Fee Approval Module

#### 4.1.1 School Setup Wizard

| **FR-SET-01** | The system shall provide a guided setup wizard on first installation. |
|---|---|
| **FR-SET-02** | Setup wizard shall capture: school name, logo, registration number, physical address, postal address, telephone, email, contact person, school code, term structure, academic year, legal entity details, district, and region metadata. |
| **FR-SET-03** | Setup wizard shall allow configuration of default chart of accounts, fee categories, and school branding. |
| **FR-SET-04** | Setup wizard shall support banking configuration (2-4 accounts) with: bank name, account name, account number, branch, SWIFT/branch code, currency type (ZiG or FCA), and designated fee category. |

#### 4.1.2 Banking Configuration

| **FR-BNK-01** | Each bank account must be assigned to a specific fee stream: Tuition, Levy/SDC, Boarding, or Project account. |
|---|---|
| **FR-BNK-02** | Tuition and Levy must each have separate bank account mappings. |
| **FR-BNK-03** | Both ZiG and FCA options must be available for each fee stream. |
| **FR-BNK-04** | Banking details must be stored as auditable records tied to payment instructions and receipts. |

#### 4.1.3 Fund Segregation

| **FR-FND-01** | Fund A (Tuition/Government Account) and Fund B (SDC/SDA Project Account) must be segregated. |
|---|---|
| **FR-FND-02** | Each fund must have separate general ledger structure and authorization rules. |
| **FR-FND-03** | Transactions must be explicitly assigned to the appropriate fund. |
| **FR-FND-04** | Reporting must clearly separate Fund A and Fund B activities. |

#### 4.1.4 Fee Policy and Approval Workflow

| **FR-FEE-01** | Proposed fees must not become active until AGM minutes and MoPSE approval letter are uploaded. |
|---|---|
| **FR-FEE-02** | Approval evidence must be stored in a digital document vault with integrity hashing. |
| **FR-FEE-03** | Approval status transitions must be fully auditable with timestamp and user ID. |
| **FR-FEE-04** | Fee structures must support annual and term-based setup. |
| **FR-FEE-05** | Locking of fee structures after approval must prevent unauthorized changes. |
| **FR-FEE-06** | Multi-currency amount mapping (USD and ZiG) must be supported for all fee items. |
| **FR-FEE-07** | Fee structures must support tuition and levy in both ZiG and FCA accounting structures. |
| **FR-FEE-08** | Outstanding balances must be carried forward from previous terms and school years automatically. |

#### 4.1.5 Fee Approval Business Rules

| **BR-FEE-01** | Fee structure activation is blocked until required documents are attached and approved. |
|---|---|
| **BR-FEE-02** | Active fee plans cannot be changed without formal approval and version-controlled revision. |
| **BR-FEE-03** | Every fee and adjustment must be associated with a ledger account, fund, term, and currency basis. |
| **BR-FEE-04** | Outstanding balances must be visible, receiptable, and reportable as prior-period debt. |

### 4.2 Student Registry and Lifecycle Management

#### 4.2.1 Application Stage (Prospective Pipeline)

| **FR-APP-01** | System shall capture applicant demographics: full legal name, date of birth, gender, home address. |
|---|---|
| **FR-APP-02** | System shall capture target placement: academic year, intended term, entry level, attendance type. |
| **FR-APP-03** | System shall capture previous academic record: school name, EMIS number, last grade completed. |
| **FR-APP-04** | System shall capture national examination performance where applicable. |
| **FR-APP-05** | System shall track application fee receipt number, amount, payment method, and currency. |
| **FR-APP-06** | System shall track application assessment status: Under Review, Waitlisted, Accepted, Declined. |
| **FR-APP-07** | System shall support document attachments for application materials. |

#### 4.2.2 Enrolment Stage

| **FR-ENR-01** | System shall capture offer acceptance documentation and parent acceptance date. |
|---|---|
| **FR-ENR-02** | System shall store statutory compliance documents: birth certificate, passport photo, transfer letter, immunization card. |
| **FR-ENR-03** | System shall track enrolment billing triggers: registration fee, boarding deposit, infrastructure levy. |
| **FR-ENR-04** | System shall assign: Student ID, MoPSE Admission Number, entry date, assigned class stream. |

#### 4.2.3 Student Registry (Core Master Data)

| **FR-STU-01** | System shall maintain a central registry of all active and inactive students. |
|---|---|
| **FR-STU-02** | Registry shall store: System Student ID, MoPSE Admission Number, National Birth Entry Number. |
| **FR-STU-03** | Registry shall store: full name, known name/alias, sex, date of birth, nationality, mother tongue. |
| **FR-STU-04** | Registry shall track status flags: Active, Suspended, Withdrawn, Transferred Out, Deceased, Completed/Alumnus. |
| **FR-STU-05** | Registry shall track funding type: Self-Sponsored, BEAM, Staff Child, External Trust/Scholarship. |
| **FR-STU-06** | Registry shall track BEAM details: vulnerability classification, district social welfare reference number. |
| **FR-STU-07** | Registry shall track: day scholar vs. boarder, hostel/dormitory room assigned, bus route, lunch scheme. |

#### 4.2.4 Student Record (Comprehensive Profile)

| **FR-STU-08** | System shall store primary and secondary guardian details: names, relationship, national ID, address, employer. |
|---|---|
| **FR-STU-09** | System shall store contact channels: mobile numbers, billing email address. |
| **FR-STU-10** | System shall store legal custody information: court order flags, legal guardian designations. |
| **FR-STU-11** | System shall store medical profile: blood group, allergies, chronic conditions, medications, emergency contacts. |
| **FR-STU-12** | System shall store Special Educational Needs (SEN) information. |
| **FR-STU-13** | System shall store academic history: termly report cards, GPA/aggregates. |
| **FR-STU-14** | System shall store extracurricular tracking: sports houses, clubs, leadership positions. |
| **FR-STU-15** | System shall store disciplinary log: infractions, dates, hearing notes, corrective actions. |
| **FR-STU-16** | System shall store transfer history: departure date, destination school, reason, clearance certificate number. |

### 4.3 Billing and Invoicing Module

#### 4.3.1 Invoice Generation

| **FR-INV-01** | System shall support automated batch invoicing by class, whole school, sponsor, or beneficiary category. |
|---|---|
| **FR-INV-02** | System shall generate invoices with unique sequential invoice numbers. |
| **FR-INV-03** | System shall support split billing where different fee items are assigned to different funding sources. |
| **FR-INV-04** | System shall calculate pro-rata billing for mid-term admissions and withdrawals. |
| **FR-INV-05** | System shall produce transfer-out clearance balances. |
| **FR-INV-06** | System shall support print and digital distribution via PDF, SMS, and email. |

#### 4.3.2 Invoice Business Rules

| **BR-INV-01** | Invoice items must be mapped to the correct ledger accounts and funding source. |
|---|---|
| **BR-INV-02** | No duplicate invoice numbers may be created. |
| **BR-INV-03** | Students with approved sponsorship must show the sponsor as the primary payer while keeping the learner ledger intact. |

#### 4.3.3 Beneficiary Categories

| **FR-BEN-01** | System shall support: Standard Parent Payee, BEAM Beneficiary, Staff Child, Third-Party Sponsor/Trust/Embassy/NGO. |
|---|---|
| **FR-BEN-02** | Different fee items shall be assignable to different funding sources. |
| **FR-BEN-03** | BEAM and parent obligations shall be tracked separately. |
| **FR-BEN-04** | Discretionary items shall remain parent-billed. |

### 4.4 Cash Office and Point of Sale Module

#### 4.4.1 Receipting Engine

| **FR-RCT-01** | System shall support: cash, bank transfer, direct debit, card, mobile money, and bank import. |
|---|---|
| **FR-RCT-02** | System shall support split tender in multiple currencies (USD and ZiG). |
| **FR-RCT-03** | System shall generate unique sequential receipt numbers (gapless sequence). |
| **FR-RCT-04** | System shall produce tamper-evident print and digital receipt outputs. |
| **FR-RCT-05** | Receipt shall include: receipt number, date/time, cashier ID, payment channel, currency, amount, account mapping. |
| **FR-RCT-06** | System shall record payment allocation: current due, previous arrears, or advance payment. |
| **FR-RCT-07** | System shall capture external reference: bank deposit slip number, EcoCash/ZIPIT reference, or POS batch number. |
| **FR-RCT-08** | System shall record payee data: name, contact number, receipt notes. |

#### 4.4.2 Reversal and Credit Note Controls

| **FR-REV-01** | Receipt deletion is prohibited. |
|---|---|
| **FR-REV-02** | Only authorized supervisors can create reversals or credit notes. |
| **FR-REV-03** | Reversal requires mandatory justification and approval note. |
| **FR-REV-04** | All reversals must generate corresponding compensating ledger entries. |
| **FR-REV-05** | Reversal must preserve original receipt reference and audit trail. |

#### 4.4.3 Digital Payment Reconciliation

| **FR-REC-01** | System shall support import of CSV or bank files with payment references. |
|---|---|
| **FR-REC-02** | System shall match imported payments to internal student identifiers and invoices. |
| **FR-REC-03** | System shall support major Zimbabwean banks and mobile money channels. |
| **FR-REC-04** | System shall flag unmatched payments for manual review. |

#### 4.4.4 Daily Cash-Up

| **FR-CSH-01** | System shall support daily reconciliation of physical cash, electronic payments, and bank transfers. |
|---|---|
| **FR-CSH-02** | System shall support cashier handover process. |
| **FR-CSH-03** | System shall provide automated variance reporting. |
| **FR-CSH-04** | System shall support lockout if mismatch exceeds configured threshold. |

#### 4.4.5 Cash Office Business Rules

| **BR-RCT-01** | Every payment must be recorded with payer, school, student, transaction date, currency, configured bank account, and receipt number. |
|---|---|
| **BR-RCT-02** | A cash office cannot issue a receipt without valid student/invoice reference and proper authorization. |
| **BR-RCT-03** | All reversals must be audit-logged with justification. |

### 4.5 Debtor Management and Parent Communications Module

#### 4.5.1 Debt Tracking

| **FR-DBT-01** | System shall track outstanding balances by fee type and learner. |
|---|---|
| **FR-DBT-02** | System shall support ageing buckets: 30, 60, 90+ days. |
| **FR-DBT-03** | System shall support class-level and grade-level summarization. |
| **FR-DBT-04** | System shall generate aged debtor reports. |

#### 4.5.2 Payment Plan Management

| **FR-PPL-01** | System shall support structured installment plans with milestone dates. |
|---|---|
| **FR-PPL-02** | System shall generate Acknowledgment of Debt (AOD) letters. |
| **FR-PPL-03** | System shall track default and support escalation logic. |
| **FR-PPL-04** | System shall support digital signature of payment plans by parents. |

#### 4.5.3 Communication Controls

| **FR-COM-01** | System shall send SMS, WhatsApp, and email reminders. |
|---|---|
| **FR-COM-02** | Communications must be restricted to parent/guardian contact channels only. |
| **FR-COM-03** | System shall not generate or expose learner-facing public debt lists. |
| **FR-COM-04** | All communications shall be logged in the communication log. |

#### 4.5.4 Legal Escalation Workflow

| **FR-LEG-01** | System shall support debtor case management for legal counsel or school administration. |
|---|---|
| **FR-LEG-02** | System shall support exportable documents for legal recovery processes. |
| **FR-LEG-03** | All AOD and legal escalation actions shall be version-tracked and signed. |

#### 4.5.5 Debtor Business Rules

| **BR-DBT-01** | Fee debt cannot be used to deny access to class or examinations. |
|---|---|
| **BR-DBT-02** | Parent/guardian communications must not reveal sensitive fee information in public channels. |
| **BR-DBT-03** | All AOD and legal escalation actions are version-tracked and signed with an authorized school role. |

### 4.6 Procurement, Expenditure, and Cashbook Control Module

#### 4.6.1 Requisition Workflow

| **FR-REQ-01** | System shall support staff or department submission of requisition. |
|---|---|
| **FR-REQ-02** | Requisition shall include: item description, quantity, cost, budget line, and vendor references. |
| **FR-REQ-03** | System shall check available budget vote balance before requisition approval. |

#### 4.6.2 PRAZ Micro-Procurement Control

| **FR-PRA-01** | For amounts exceeding threshold bands, system shall require three supplier quotations. |
|---|---|
| **FR-PRA-02** | System shall calculate and enforce based on defined thresholds. |
| **FR-PRA-03** | System shall validate digital documents before PO issuance. |
| **FR-PRA-04** | Thresholds shall be configurable per school. |

#### 4.6.3 Purchase Order Issuance

| **FR-PO-01** | System shall issue purchase orders with approved vendors and line items. |
|---|---|
| **FR-PO-02** | System shall track encumbrance against budget votes. |
| **FR-PO-03** | System shall support PO amendments with audit trail. |

#### 4.6.4 Payment Voucher Authorization

| **FR-PV-01** | System shall require sequential approval by requisitioner, bursar, SDC Chair/Treasurer, and school head. |
|---|---|
| **FR-PV-02** | Final approval cannot be the same person as the requisitioner. |
| **FR-PV-03** | System shall support dual-authorization for sensitive procurements. |
| **FR-PV-04** | All Payment Vouchers shall be stored as audit evidence. |

#### 4.6.5 Budget Vote-Book Control

| **FR-BGT-01** | System shall prevent overspending beyond budget vote allocations. |
|---|---|
| **FR-BGT-02** | System shall block unallocated budget commitments. |
| **FR-BGT-03** | Staff shall be able to see amount remaining per vote. |

#### 4.6.6 Petty Cash Control

| **FR-PET-01** | System shall support float issuance and tracking. |
|---|---|
| **FR-PET-02** | System shall support reconciliation and replenishment. |
| **FR-PET-03** | System shall support disposal tracking. |

#### 4.6.7 Procurement Business Rules

| **BR-PRO-01** | Spending cannot exceed budget vote allocations. |
|---|---|
| **BR-PRO-02** | Disbursement must be approved by multiple signatories in the proper sequence. |
| **BR-PRO-03** | Payment vouchers are stored as audit evidence and tied to the related expenditure classification. |

### 4.7 General Ledger, Cashbook, and Financial Statements Module

#### 4.7.1 Chart of Accounts Management

| **FR-COA-01** | System shall maintain standardized school accounts with fund, department, class, and cost center logic. |
|---|---|
| **FR-COA-02** | System shall support separate tracking for Fund A and Fund B. |
| **FR-COA-03** | Chart of accounts shall be customizable. |

#### 4.7.2 Double-Entry Posting

| **FR-JRN-01** | System shall support standard journal entries and reversing entries. |
|---|---|
| **FR-JRN-02** | System shall support automatic posting for receipts, expenditure, debt adjustments, and transfers. |
| **FR-JRN-03** | All journal entries shall be auditable with user ID, timestamp, and justification. |

#### 4.7.3 Cashbook Management

| **FR-CBK-01** | System shall provide daily transaction log across all cash and bank movement. |
|---|---|
| **FR-CBK-02** | System shall match statement and cash-book variations. |
| **FR-CBK-03** | System shall support monthly 3-way bank reconciliations. |

#### 4.7.4 Financial Statement Generation

| **FR-FIN-01** | System shall generate: Income Statement, Receipts and Payments Summary, Balance Sheet, Cash Flow Statements. |
|---|---|
| **FR-FIN-02** | System shall support multi-currency reporting in both USD and ZiG values. |
| **FR-FIN-03** | System shall generate comparative reports (current vs prior period). |
| **FR-FIN-04** | System shall support export to PDF, Excel, and CSV formats. |

#### 4.7.5 Asset and Inventory Register

| **FR-ASS-01** | System shall track fixed assets with: asset code, description, PO reference, acquisition date, historical cost. |
|---|---|
| **FR-ASS-02** | System shall support depreciation calculation (straight line with configurable rates). |
| **FR-ASS-03** | System shall track asset condition and disposal status. |
| **FR-ASS-04** | System shall support PRAZ disposal register requirements. |

#### 4.7.6 Ledger Business Rules

| **BR-LED-01** | All committed transactions must be journal-posted before financial statements can be generated. |
|---|---|
| **BR-LED-02** | Changing a posted transaction requires reversal or adjustment entries with logged reason and approval. |
| **BR-LED-03** | Trial balance must balance before final report closure. |
| **BR-LED-04** | Year-end closing must be performed after audit completion. |

### 4.8 Statutory Financial Statements and Returns Framework

#### 4.8.1 Statement of Receipts and Payments (Cash Flow on Cash Basis)

| **FR-SRP-01** | System shall generate Statement of Receipts and Payments in the prescribed MoPSE format. |
|---|---|
| **FR-SRP-02** | Statement shall show all actual cash inflows and outflows across all bank accounts and cash drawers. |
| **FR-SRP-03** | Statement shall include: opening balances, operating inflows, other inflows, total receipts, payments by category, closing balances. |
| **FR-SRP-04** | Statement shall support dual-column presentation (USD and ZiG). |
| **FR-SRP-05** | Statement shall include comparative prior period figures. |

#### 4.8.2 Statement of Comprehensive Income (Income & Expenditure)

| **FR-SCI-01** | System shall generate Statement of Comprehensive Income under accrual basis (IPSAS 1). |
|---|---|
| **FR-SCI-02** | Statement shall show revenue from non-exchange transactions and exchange transactions. |
| **FR-SCI-03** | Statement shall show expenditure by category. |
| **FR-SCI-04** | Statement shall include depreciation expense, provision for bad debts. |
| **FR-SCI-05** | Statement shall show surplus/deficit for the period. |

#### 4.8.3 Statement of Financial Position (Balance Sheet)

| **FR-SFP-01** | System shall generate Statement of Financial Position under IPSAS guidelines. |
|---|---|
| **FR-SFP-02** | Statement shall show non-current assets, current assets, accumulated funds, and current liabilities. |
| **FR-SFP-03** | Statement shall support comparative prior year figures. |
| **FR-SFP-04** | Statement shall be generated in USD (primary reporting currency) with ZiG equivalent. |

#### 4.8.4 Vote-Book (Budget vs. Actual Variance Report)

| **FR-VOT-01** | System shall generate Vote-Book report with: Vote Code, Description, Approved Budget, Cumulative Spend, Outstanding Commitments, Available Balance, % Spend Burn. |
|---|---|
| **FR-VOT-02** | System shall prevent payments if the vote line is depleted. |
| **FR-VOT-03** | System shall support real-time budget utilization tracking. |

#### 4.8.5 Monthly Bank Reconciliation Statement

| **FR-BRS-01** | System shall generate separate monthly reconciliation for every operational bank account. |
|---|---|
| **FR-BRS-02** | Statement shall show: balance per bank statement, deposits in transit, unpresented cheques, adjustments, balance per cashbook. |
| **FR-BRS-03** | System shall support reconciliation sign-off by bursar and head. |

#### 4.8.6 Statutory MoPSE Termly Financial Return (ED46)

| **FR-ED46-01** | System shall generate MoPSE ED46 Termly Financial Return in the prescribed format. |
|---|---|
| **FR-ED46-02** | Return shall include: school header, enrolment & levy base data, revenue realization, staffing support analysis. |
| **FR-ED46-03** | Return shall support certification by School Head, SDC Chairperson, and Senior Bursar. |
| **FR-ED46-04** | Return shall be exportable to PDF and Excel. |

#### 4.8.7 BEAM Claims & Disbursement Reconciliation

| **FR-BEAM-01** | System shall generate BEAM Claims & Disbursement Reconciliation Statement. |
|---|---|
| **FR-BEAM-02** | Statement shall show: student ID, name, grade, term billed, tuition arrears claimed, SDC levy arrears claimed, Treasury amount disbursed, cumulative unpaid claim. |
| **FR-BEAM-03** | System shall support import of BEAM disbursement files. |

#### 4.8.8 Fixed Assets, Depreciation & PRAZ Disposal Register

| **FR-FAR-01** | System shall generate Fixed Assets Register with: Asset Serial Code, Description, PRAZ Reference, Date Acquired, Historical Cost, Depreciation Method & Rate, Accumulated Depreciation, Net Book Value, Physical Location, Condition/Disposal Status. |
|---|---|
| **FR-FAR-02** | System shall calculate depreciation automatically. |
| **FR-FAR-03** | System shall track disposals with PRAZ approval reference. |

### 4.9 Reporting Module

#### 4.9.1 Statutory & Ministry Reports

| **FR-RPT-01** | Termly MoPSE Financial Return (ED46 / ED46B) |
|---|---|
| **FR-RPT-02** | Annual School Census Return (EMIS) |
| **FR-RPT-03** | BEAM claims and reconciliation report |
| **FR-RPT-04** | Statement of Receipts and Payments |
| **FR-RPT-05** | Statement of Comprehensive Income |
| **FR-RPT-06** | Statement of Financial Position |
| **FR-RPT-07** | Vote-Book Budget Variance Report |
| **FR-RPT-08** | Monthly Bank Reconciliation Statement |
| **FR-RPT-09** | Fixed Assets Register |

#### 4.9.2 SDC Governance Reports

| **FR-RPT-10** | AGM financial statement pack |
|---|---|
| **FR-RPT-11** | Capital project register |
| **FR-RPT-12** | SDC receipts and payments summary |
| **FR-RPT-13** | Outstanding debtor analysis |

#### 4.9.3 Operational Reports

| **FR-RPT-14** | Daily / weekly cashier reconciliation |
|---|---|
| **FR-RPT-15** | Aged debtor report (30, 60, 90+ days) |
| **FR-RPT-16** | Vote-book commitment ledger report |
| **FR-RPT-17** | Safe balance and cash movement reports |
| **FR-RPT-18** | Student fee statements |
| **FR-RPT-19** | Class-level fee summary |

#### 4.9.4 Audit Reports

| **FR-RPT-20** | Multi-currency trial balance |
|---|---|
| **FR-RPT-21** | Bank reconciliation statement |
| **FR-RPT-22** | Fixed asset register |
| **FR-RPT-23** | Access log summary and transaction activity report |
| **FR-RPT-24** | Audit trail export package |

#### 4.9.5 Report Output Formats

| **FR-RPT-25** | PDF (professional layout, signed/unsigned) |
|---|---|
| **FR-RPT-26** | Excel (.xlsx) |
| **FR-RPT-27** | CSV |
| **FR-RPT-28** | JSON (for audit software integration) |
| **FR-RPT-29** | HTML (for portal viewing) |

#### 4.9.6 Report Business Rules

| **BR-RPT-01** | All reports must include school header/letterhead, report date, and page numbering. |
|---|---|
| **BR-RPT-02** | Financial reports must show currency (USD, ZiG, or both). |
| **BR-RPT-03** | Reports must be accessible only to authorized roles. |
| **BR-RPT-04** | Report generation must be logged in audit trail. |

### 4.10 Parent Portal

#### 4.10.1 Registration and Access

| **FR-PRT-01** | Parents must receive an invitation email/SMS with secure registration link. |
|---|---|
| **FR-PRT-02** | System shall generate unique registration token tied to parent contact details. |
| **FR-PRT-03** | Parents cannot self-register without an invitation. |
| **FR-PRT-04** | Parent accounts shall be linked to one or more students. |
| **FR-PRT-05** | System shall support password reset via email/SMS. |

#### 4.10.2 Parent Dashboard

| **FR-PRT-06** | Parent dashboard shall show live itemized fee statements. |
|---|---|
| **FR-PRT-07** | Dashboard shall show debit lines and credit entries. |
| **FR-PRT-08** | Dashboard shall show total outstanding balance. |
| **FR-PRT-09** | Dashboard shall support download of PDF receipts and statements. |

#### 4.10.3 Online Payments

| **FR-PRT-10** | Parents shall be able to initiate direct integrated payments. |
|---|---|
| **FR-PRT-11** | Payment channels shall include: EcoCash (Phase 1), bank transfer (Phase 1), cards (Phase 2). |
| **FR-PRT-12** | Online payments shall generate instant receipt. |
| **FR-PRT-13** | System shall support payment plan enrollment and digital signing. |

#### 4.10.4 Notifications

| **FR-PRT-14** | Parents shall receive SMS/email when invoice is raised, payment clears, or installment deadline approaches. |
|---|---|
| **FR-PRT-15** | Parents shall receive statement delivery notifications. |
| **FR-PRT-16** | Parents shall receive debt notice communications. |

#### 4.10.5 Parent Portal Restrictions

| **BR-PRT-01** | Parents are restricted to their own children's records only. |
|---|---|
| **BR-PRT-02** | Parents cannot access school-wide financial reports. |
| **BR-PRT-03** | Parents cannot modify financial records. |

---

## 5. Role-Based Access Control (RBAC)

### 5.1 Master Permissions Matrix

| **Functional Capability** | **Bursar/Accountant** | **School Head** | **SDC Chair/Treasurer** | **Parent/Guardian** | **Student** | **System Admin** | **District Auditor (MoPSE)** |
|---|---|---|---|---|---|---|---|
| Issue POS Multi-Currency Receipts | Full | View | No | No | No | No | No |
| Approve Termly Fee Structures | Draft | Co-Sign | Co-Sign | View (AGM) | No | No | View |
| Authorize Payment Vouchers (PV) | Verify Vote | Approve | Co-Approve | No | No | No | View |
| Initiate General Journal Reversals | Request | Authorize | No | No | No | No | View |
| Generate MoPSE ED46 Returns | Compile | Sign-Off | View | No | No | No | Audit Export |
| View Live General Ledger/Cashbook | Full | Full | Read (SDC) | No | No | No | Read-Only |
| View Student Balance & Statement | Full | Full | No | Self Only | Self Only | No | Full |
| Direct Online/Mobile Payments | No | No | No | Execute | No | No | No |
| Manage System Backups & RBAC | No | No | No | No | No | Full | No |

### 5.2 Detailed User Role Profiles

#### 5.2.1 School Bursar / Senior Accountant

**Role Objectives:** Record all financial flows accurately, manage POS receipting, balance multi-currency drawers daily, reconcile bank statements.

**Permissions & Core Duties:**
- POS: Issue tamper-evident, multi-currency receipts and assign each payment to the correct configured school account.
- Invoicing Engine: Run batch termly debit invoicing for registered learners.
- Cash Office Reconciliation: Conduct daily cash-ups, balancing physical cash safe balances against POS till runs.
- Expenditure & Vote-Book Processing: Enter supplier purchase requisitions, log three independent PRAZ quotations, verify available budget lines, draft Payment Vouchers.
- Reconciliations: Execute monthly 3-way bank reconciliations.
- Reporting: Generate draft Trial Balances, aged debtor reports, asset registers, and MoPSE ED46 schedules.

**System Restrictions:**
- Cannot finalize or increase fee schedules without attached Ministry approval.
- Cannot delete or edit issued receipts.
- Cannot approve Payment Vouchers for payment execution.

#### 5.2.2 School Head / Principal (Accounting Officer)

**Role Objectives:** Maintain institutional oversight, authorize procurements, enforce compliance with the Education Act, certify government returns.

**Permissions & Core Duties:**
- Statutory Compliance Gateway: Uploads and verifies the signed MoPSE Fee Approval Letter and AGM parent minutes before the system activates a fee hike.
- Expenditure Clearance: Serves as mandatory signatory on all Payment Vouchers.
- Adjustment Authorization: Reviews and authorizes credit notes, billing reversals, and write-offs.
- Statutory Report Certification: Digitally signs and exports MoPSE ED46 Termly Returns.
- Beneficiary Verification: Approves the final register of BEAM recipients.

**System Restrictions:**
- Restricted from directly collecting cashier cash or issuing POS receipts.
- Cannot unilaterally initiate and disburse SDC funds without SDC executive co-authorization.

#### 5.2.3 SDC Chairperson & Treasurer

**Role Objectives:** Guard parental contributions, approve developmental capital spending, monitor project delivery.

**Permissions & Core Duties:**
- Joint Expenditure Authorization: Co-approves all SDC purchase requisitions and payment vouchers.
- SDC Capital Projects Tracking: Monitors vote-book spending lines for infrastructure projects.
- AGM Financial Statements: Reviews and accepts draft financial statements ahead of AGM.
- Procurement Oversight: Validates PRAZ quotations attached to major procurements.

**System Restrictions:**
- Strictly read-only access to individual learner records.
- No access to Fund A (Government Tuition/Grants/Salary subsidies).
- Cannot enter journal adjustments or directly issue receipts.

#### 5.2.4 Parent / Guardian

**Role Objectives:** Monitor student financial standing, process payments remotely, ensure debt compliance.

**Permissions & Core Duties:**
- Self-Service Financial Dashboard: View live, itemized fee statements.
- Digital Remote Payments: Initiate integrated payments via EcoCash, bank transfers.
- Statement & Receipt Downloads: Download PDF copies of historic receipts, clearance letters.
- Payment Plan Management: Review and digitally sign structured SDC Acknowledgment of Debt.

**System Restrictions:**
- Restricted strictly to their own children's records.
- Cannot access school-wide financial reports.

#### 5.2.5 Student / Learner

**Role Objectives:** Access learning credentials, verify enrolment status.

**Permissions & Core Duties:**
- Student Profile Dashboard: View personal enrolment status, assigned class stream.
- Academic Progress: View published termly academic report cards.
- Library & School Asset Status: Verify textbooks and equipment checked out.
- View Fee Balance (Read-Only): View personal fee balance strictly as informational notification.

**System Restrictions:**
- Cannot modify any profile, academic, or financial records.
- No access to payment processing.

#### 5.2.6 System Administrator / IT Officer

**Role Objectives:** Maintain platform infrastructure, data security, role assignments, and backup integrity.

**Permissions & Core Duties:**
- Identity & Access Management: Create, activate, deactivate staff user accounts, assign granular permissions.
- System Configuration: Configure academic terms, calendar dates, class streams, subject lists.
- Data Backups & Recovery: Manage scheduled backups and restore processes.
- Audit Log Review: Monitor system access logs, IP authentication failures, data manipulation events.

**System Restrictions:**
- Strict Separation of Duties: Cannot issue receipts, alter ledger balances, approve requisitions, or post financial journals.

#### 5.2.7 District Education Auditor / Inspector

**Role Objectives:** Audit school records for financial and administrative compliance.

**Permissions & Core Duties:**
- Read-Only Audit Portal: Read-only access to general ledger, vote books, bank reconciliation statements, procurement archives.
- Statutory Compliance Checks: Direct export of MoPSE ED46 returns, approved fees vs. invoiced rates analysis.
- Audit Trail Investigation: Complete access to unalterable audit log.

**System Restrictions:**
- Strictly read-only; cannot add, modify, delete, or reverse any system record.

### 5.3 Access Control Requirements

| **AC-01** | Least-privilege model must be enforced with granular permissions. |
|---|---|
| **AC-02** | All login events and user actions must be logged with timestamp, user ID, and device metadata. |
| **AC-03** | Role changes require an approval process and audit logging. |
| **AC-04** | Multi-factor authentication for privileged users. |
| **AC-05** | Session timeout after 30 minutes of inactivity. |

---

## 6. Audit Trail and Internal Controls

### 6.1 Immutable Ledger Principle

| **AU-01** | System must implement append-only transaction records. |
|---|---|
| **AU-02** | Once posted, transactions cannot be deleted. |
| **AU-03** | Modifications are recorded as reversal or adjustment entries. |
| **AU-04** | Original transaction IDs are retained. |
| **AU-05** | Operator, time, and reason of change are logged. |

### 6.2 Audit Log Requirements

The audit log must capture:

| **AU-06** | User login and logout |
|---|---|
| **AU-07** | User permission changes |
| **AU-08** | Invoice creation or edit |
| **AU-09** | Receipt generation and adjustments |
| **AU-10** | Payment voucher approval and rejection |
| **AU-11** | Procurement quote validation |
| **AU-12** | Bank reconciliation changes |
| **AU-13** | Debtor communication events |
| **AU-14** | Export actions and report generation |
| **AU-15** | System configuration changes |
| **AU-16** | Backup and restore events |
| **AU-17** | Failed login attempts |

### 6.3 Security Metadata

Each transaction event must include:

| **AU-18** | User ID |
|---|---|
| **AU-19** | Role |
| **AU-20** | Server timestamp |
| **AU-21** | Device/IP identifier |
| **AU-22** | Action type |
| **AU-23** | Object ID |
| **AU-24** | Justification note |
| **AU-25** | Previous state and new state |
| **AU-26** | Digital signature/hash of record |

---

## 7. Offline-Resilient Architecture

### 7.1 Requirement

| **OF-01** | System must continue operating in environments with poor internet connectivity. |
|---|---|
| **OF-02** | Offline capability is critical in rural and semi-urban schools. |

### 7.2 Offline Capabilities

| **OF-03** | Cashiers can use a local encrypted SQLite/IndexedDB store to issue receipts offline. |
|---|---|
| **OF-04** | Receipts are signed client-side with a locally generated reference and validation sequence. |
| **OF-05** | System stores pending sync data until connectivity returns. |
| **OF-06** | Automated sync resolves conflicts with sequence timestamps and receipt IDs. |
| **OF-07** | Offline receipt number format: OFF-{Timestamp}-{CashierID}-{Sequence}. |
| **OF-08** | Replacement by system-generated sequential number upon sync. |

### 7.3 Online Reconciliation

| **OF-09** | Pending receipt data is synchronized to the central server when connectivity resumes. |
|---|---|
| **OF-10** | Duplicate detection uses receipt serial and student ID combination. |
| **OF-11** | Conflicts are quarantined for dispute review and audit approval. |
| **OF-12** | First receipt synced retains its temporary number until manual resolution. |

---

## 8. Integration Requirements

### 8.1 Core Integrations

| **INT-01** | Bank statement import for USD and ZiG (CSV/Excel) |
|---|---|
| **INT-02** | Mobile money provider import feeds (EcoCash, OneMoney) |
| **INT-03** | Exchange-rate service or manual bank feed |
| **INT-04** | SMS gateway (Africa's Talking, Twilio, or similar) |
| **INT-05** | WhatsApp Business API (optional, configurable) |
| **INT-06** | Email delivery service (SMTP) |
| **INT-07** | Document storage and approval attachments (Frappe File Manager) |
| **INT-08** | Payment gateway (EcoCash Merchant API - Phase 1) |
| **INT-09** | Payment gateway (Paynow/ZimSwitch - Phase 2) |

### 8.2 Data Exchange Standards

| **INT-10** | CSV and Excel for bulk payment imports |
|---|---|
| **INT-11** | PDF for invoice, receipt, and report export |
| **INT-12** | JSON/XML for API integration where needed |
| **INT-13** | Secure document attachment storage with SHA-256 checksum |

### 8.3 Email Configuration

| **INT-14** | Email address: `MAIL_ADMIN_ADDRESS` (env var, set only in the deployment's secrets store) |
|---|---|
| **INT-15** | Password: `MAIL_ADMIN_PASSWORD` (env var, never committed to source control) |
| **INT-16** | Incoming server: `MAIL_INCOMING_HOST` (env var) |
| **INT-17** | Outgoing server: `MAIL_OUTGOING_HOST` (env var) |
| **INT-18** | Standard SMTP/IMAP/POP3 defaults as configured by hosting environment |

### 8.4 QR Code Authentication

| **INT-19** | All generated student statements, payment receipts, and official school financial documents must include a QR code. |
|---|---|
| **INT-20** | QR code must confirm authenticity and link the document to the school-issued record in the system database. |
| **INT-21** | QR code must include: document ID, school ID, student ID (if applicable), timestamp, and document type. |

---

## 9. Data Model

### 9.1 Core Entities

| **Entity** | **Purpose** |
|---|---|
| School | School profile and configuration |
| AcademicYear | Academic year definition |
| Term | Term definition within academic year |
| Student | Learner master data |
| ParentGuardian | Parent/guardian information |
| BeneficiaryCategory | Fee category/funding source |
| FeeStructure | Fee schedule for a term |
| FeeItem | Individual fee item |
| Invoice | Student invoice |
| InvoiceLine | Line item on invoice |
| Receipt | Payment receipt |
| PaymentMethod | Payment method definition |
| JournalEntry | Ledger journal entry |
| Account | Chart of accounts |
| Fund | Fund A or Fund B |
| CostCenter | Cost center/department |
| Requisition | Purchase requisition |
| PurchaseOrder | Purchase order |
| PaymentVoucher | Payment voucher |
| DebtorCase | Debtor management case |
| PaymentPlan | Structured payment plan |
| CommunicationLog | Parent communication log |
| DocumentAttachment | Document metadata |
| AuditLog | System audit trail |
| User | System user |
| Role | User role |
| Session | User session |
| AssetRegister | Fixed asset |

### 9.2 Key Data Relationships

| **REL-01** | One school has many students and many financial periods. |
|---|---|
| **REL-02** | One student has many invoices and many receipts. |
| **REL-03** | One invoice has many invoice lines. |
| **REL-04** | One receipt may match many payment methods and ledger entries. |
| **REL-05** | Each fee item is linked to a fund, cost center, and account code. |
| **REL-06** | Each payment voucher is linked to a requisition and approval chain. |
| **REL-07** | Each document attachment is associated with a transaction or approval event. |

### 9.3 Field Validation Rules

| **VAL-01** | All currency amounts must have 2 decimal places. |
|---|---|
| **VAL-02** | Student ID must be unique and non-null. |
| **VAL-03** | Receipt number must be unique and sequential. |
| **VAL-04** | Invoice number must be unique and sequential. |
| **VAL-05** | Email addresses must be valid format. |
| **VAL-06** | Phone numbers must be valid Zimbabwean format (primary). |
| **VAL-07** | Dates must be valid and logically consistent. |
| **VAL-08** | Total debit must equal total credit in journal entries. |

---

## 10. Functional Workflows

### 10.1 Term Planning and SDC AGM Flow

1. School prepares annual/term fee proposal.
2. SDC AGM/parent meeting occurs with quorum confirmation.
3. Minutes and resolution are uploaded.
4. MoPSE approval letter is uploaded.
5. Fee structure enters approval workflow.
6. Approved fee plan is activated.
7. Multi-currency ledger rule is locked for the relevant term.

### 10.2 Billing and Receipting Flow

1. System identifies active fee structure by term and learner status.
2. Invoice run generates required fees by student/class.
3. Payment channels include cash, bank, card, mobile money, bulk import.
4. Receipts are generated and matched to student and invoice records.
5. Daily cash-up balances the office movements and verifies totals.
6. Transactions are posted to general ledger and fund sub-ledgers.

### 10.3 Procurement and Expenditure Flow

1. Department submits requisition with budget reference.
2. System checks available budget vote balance.
3. If threshold exceeded, quotation collection required before PO generation.
4. SDC and head approvals applied as required.
5. Payment voucher is created and approved.
6. Ledger posting updates budget commitment and cash movement.

### 10.4 Debt Recovery Flow

1. Aged debtor report identifies learners with overdue balances.
2. Parent/guardian contacted through approved channels.
3. Payment plan proposed and accepted.
4. AOD contract generated and stored.
5. Non-payment escalation tracked and documented.

---

## 11. Non-Functional Requirements

### 11.1 Performance

| **NFR-01** | Invoice generation for 1000+ students must complete within 10 minutes. |
|---|---|
| **NFR-02** | Dashboard and report views must load within 3 seconds. |
| **NFR-03** | POS receipt creation must respond in real time (<2 seconds). |
| **NFR-04** | Report generation for annual data must complete within 30 seconds. |
| **NFR-05** | System must support 50 concurrent users. |
| **NFR-06** | Search queries must return results within 2 seconds. |

### 11.2 Availability

| **NFR-07** | Core finance functions must support high availability during term-end billing and receipting peaks. |
|---|---|
| **NFR-08** | System uptime target: 99.5% (excluding planned maintenance). |
| **NFR-09** | Offline mode must ensure cash office operations continue under connectivity loss. |
| **NFR-10** | Planned maintenance windows must be communicated 48 hours in advance. |

### 11.3 Reliability

| **NFR-11** | Database integrity must be maintained during transaction conflict or partial sync. |
|---|---|
| **NFR-12** | Crash recovery must preserve audit log and ledger consistency. |
| **NFR-13** | Data backup and restore must be tested quarterly. |
| **NFR-14** | System must handle network interruptions gracefully. |

### 11.4 Scalability

| **NFR-15** | System must allow expansion for multiple terms and increasing transaction volumes. |
|---|---|
| **NFR-16** | New fund codes, departments, and payment channels must be configurable without code changes. |
| **NFR-17** | Database indexing must be optimized for large datasets. |

### 11.5 Security

| **NFR-18** | All data in transit must be encrypted (TLS 1.2+). |
|---|---|
| **NFR-19** | All sensitive data at rest must be encrypted. |
| **NFR-20** | Passwords must be hashed with bcrypt (12+ rounds). |
| **NFR-21** | SQL injection and XSS protection must be implemented. |
| **NFR-22** | Rate limiting must prevent brute force attacks. |
| **NFR-23** | Audit logs must be retained for 7+ years. |

### 11.6 Usability

| **NFR-24** | User interface must be intuitive and minimize training needs. |
|---|---|
| **NFR-25** | System must support keyboard shortcuts for frequent actions. |
| **NFR-26** | Error messages must be clear and actionable. |
| **NFR-27** | System must support responsive design for mobile access. |

### 11.7 Maintainability

| **NFR-28** | Code must follow Frappe development conventions. |
|---|---|
| **NFR-29** | System must have comprehensive logging for troubleshooting. |
| **NFR-30** | Configuration must be externalized from code. |
| **NFR-31** | Documentation must be kept up to date. |

---

## 12. Testing Requirements

### 12.1 Unit Testing

| **TST-01** | All business logic must have unit tests covering core functionality. |
|---|---|
| **TST-02** | Unit tests must achieve minimum 80% code coverage. |

### 12.2 Integration Testing

| **TST-03** | All integrations (SMS, email, payment gateways) must be tested in staging environment. |
|---|---|
| **TST-04** | Database transactions must be tested for consistency. |

### 12.3 User Acceptance Testing (UAT)

| **TST-05** | School financial staff must validate workflows. |
|---|---|
| **TST-06** | Parent portal must be tested by sample parents. |
| **TST-07** | All reports must be validated against sample data. |
| **TST-08** | Statutory reports must match prescribed formats. |

### 12.4 Performance Testing

| **TST-09** | Load testing must simulate peak usage (term-end billing, receipting). |
|---|---|
| **TST-10** | Stress testing must identify system breaking points. |

### 12.5 Security Testing

| **TST-11** | Security audit must validate RBAC, encryption, and access controls. |
|---|---|
| **TST-12** | Penetration testing must be conducted before production deployment. |

### 12.6 Offline Testing

| **TST-13** | Offline receipt capture must be tested with connectivity loss. |
|---|---|
| **TST-14** | Sync conflict resolution must be validated. |

---

## 13. Deployment Requirements

### 13.1 Production Environment

| **DEP-01** | Deploy on Frappe Cloud (managed hosting). |
|---|---|
| **DEP-02** | Use separate sites for production, staging, and development. |
| **DEP-03** | Database: MariaDB (managed by Frappe Cloud). |
| **DEP-04** | Storage: S3-compatible or local volumes. |

### 13.2 Staging Environment

| **DEP-05** | Staging environment must mirror production configuration. |
|---|---|
| **DEP-06** | Staging must use anonymized production data for testing. |

### 13.3 Development Environment

| **DEP-07** | Use Docker Desktop + frappe_docker. |
|---|---|
| **DEP-08** | Version control: Git (GitHub). |

### 13.4 Backup Strategy

| **DEP-09** | Automated backups daily. |
|---|---|
| **DEP-10** | RPO: 24 hours. |
| **DEP-11** | RTO: 4 hours. |
| **DEP-12** | Backup retention: 30 days (daily), 12 months (monthly), 7 years (annual). |
| **DEP-13** | Encrypted backups stored in separate geographic location. |

### 13.5 Monitoring

| **DEP-14** | Application performance monitoring (APM) must be implemented. |
|---|---|
| **DEP-15** | Error tracking must be configured. |
| **DEP-16** | System health alerts must be configured. |

---

## 14. Risks and Mitigations

| **Risk** | **Probability** | **Impact** | **Mitigation** |
|---|---|---|---|
| Incomplete approval evidence for fee activation | Medium | High | Mandatory document gate before active fee posting; validation of document completeness |
| Poorly enforced dual-currency account mapping | Medium | High | Standardized currency assignment; validation rules on account selection; audit checks |
| Weak segregation of duties | Medium | High | Role-based approval matrix; separation of duties enforcement; regular audit reviews |
| Connectivity failure during cash office receipts | High | Medium | Offline-first client with local storage; sync reconciliation logic |
| Missing procurement verification | Medium | High | Threshold-based quotation enforcement; approval workflow with document attachments |
| Data entry errors | High | Medium | Validation rules; transaction reversals with audit trail; reconciliation reports |
| System performance degradation during peak periods | Medium | Medium | Performance testing; database optimization; load balancing |
| User resistance/training gaps | Medium | Medium | Comprehensive training program; user guides; phased rollout |

---

## 15. Assumptions and Dependencies

### 15.1 Assumptions

| **ASS-01** | Schools will have basic internet connectivity for online mode. |
|---|---|
| **ASS-02** | Schools will have access to necessary hardware (computers, printers). |
| **ASS-03** | School financial staff have basic computer literacy. |
| **ASS-04** | RBZ exchange rates will be available for period-end reporting. |
| **ASS-05** | Parent contact details (phone/email) will be available and updated. |
| **ASS-06** | Schools will have the required banking infrastructure. |

### 15.2 Dependencies

| **DEP-01** | Frappe Framework v16 availability |
|---|---|
| **DEP-02** | EcoCash Merchant API availability |
| **DEP-03** | SMS gateway service availability |
| **DEP-04** | Email service availability |
| **DEP-05** | Cloud hosting infrastructure availability |

---

## 16. Glossary

| **Term** | **Definition** |
|---|---|
| AOD | Acknowledgment of Debt - formal recognition of debt by parent/guardian |
| BEAM | Basic Education Assistance Module - government program for vulnerable learners |
| Bursar | School finance officer responsible for financial operations |
| Cash-up | Daily reconciliation of cash, electronic payments, and bank transfers |
| ED46 | MoPSE termly financial return form |
| EMIS | Education Management Information System - MoPSE database |
| Frappe | Full-stack web framework for building business applications |
| IPSAS | International Public Sector Accounting Standards |
| MoPSE | Ministry of Primary and Secondary Education |
| Nostro Account | Foreign currency account held by a bank in another country |
| PFMA | Public Finance Management Act |
| PRAZ | Procurement Regulatory Authority of Zimbabwe |
| RBZ | Reserve Bank of Zimbabwe |
| RPO | Recovery Point Objective - acceptable data loss |
| RTO | Recovery Time Objective - acceptable downtime |
| SDC | School Development Committee - parent governance body |
| SDA | School Development Association |
| SIG | School Improvement Grant |
| Vote Book | Budget allocation tracking system |
| ZiG | Zimbabwe Gold - local currency introduced 2024 |
| ZIPIT | Zimbabwe Interbank Payment and Settlement System |

---

## 17. Document Approval

| **Role** | **Name** | **Signature** | **Date** |
|---|---|---|---|
| Product/Business Analyst | [Name] | [Signature] | [Date] |
| Development Lead | [Name] | [Signature] | [Date] |
| QA Lead | [Name] | [Signature] | [Date] |
| Project Manager | [Name] | [Signature] | [Date] |
| Stakeholder (Edupro) | [Name] | [Signature] | [Date] |

---

## 18. Document Change History

| **Version** | **Date** | **Author** | **Changes** |
|---|---|---|---|
| 1.0 | 2026-09-07 | Initial Draft | Initial TFS document |
| 2.0 | 2026-09-09 | Product/Analysis Team | Final version incorporating clarifications and all FR, BR, NFR, AU, OF, INT, DEP, TST specifications |

---

## 19. Appendices

### Appendix A: Sample Receipt Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    [SCHOOL LOGO]                               │
│              [SCHOOL NAME]                                     │
│            [Physical Address]                                  │
│         Tel: [Phone]  Email: [Email]                          │
│         EMIS Number: [EMIS]                                   │
│                                                               │
│                 OFFICIAL PAYMENT RECEIPT                      │
│                                                               │
│ Receipt No: [RCT-XXXXX]    Date: [DD/MM/YYYY]                │
│ Cashier: [Name]            Time: [HH:MM]                     │
│                                                               │
│ Student: [Name]           ID: [STU-XXXX]                     │
│ Class: [Class]             Term: [Term Year]                 │
│                                                               │
│ ────────────────────────────────────────────────────────────── │
│ Description          │ Amount (USD)    │ Amount (ZiG)        │
│ ────────────────────────────────────────────────────────────── │
│ Tuition Fee          │ $XXX.XX        │ ZiG XXX.XX          │
│ SDC Levy             │ $XXX.XX        │ ZiG XXX.XX          │
│ Science Practical    │ $XX.XX         │ ZiG XX.XX           │
│ ────────────────────────────────────────────────────────────── │
│ TOTAL                │ $XXX.XX        │ ZiG XXX.XX          │
│ ────────────────────────────────────────────────────────────── │
│                                                               │
│ Payment Method: [Cash/EcoCash/Bank Transfer/Card]            │
│ Reference: [Ref No]                                          │
│ Bank Account: [Account Name] - [Account No]                  │
│                                                               │
│ Amount Paid (USD): $XXX.XX                                    │
│ Amount Paid (ZiG): ZiG XXX.XX                                 │
│                                                               │
│ Outstanding Balance: $XXX.XX (USD) / ZiG XXX.XX              │
│                                                               │
│ ────────────────────────────────────────────────────────────── │
│ [QR CODE FOR VERIFICATION]                                   │
│                                                               │
│ This receipt is system-generated and tamper-evident.         │
│ Verify at: [Verification URL]                                │
│                                                               │
│ Authorized Signature: _________________                      │
│ └─────────────────────────────────────────────────────────────────┘
```

### Appendix B: Sample Student Statement Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    [SCHOOL LOGO]                               │
│              [SCHOOL NAME]                                     │
│            [Physical Address]                                  │
│         Tel: [Phone]  Email: [Email]                          │
│         EMIS Number: [EMIS]                                   │
│                                                               │
│              STUDENT FINANCIAL STATEMENT                      │
│                                                               │
│ Statement Date: [DD/MM/YYYY]                                 │
│ Currency: USD / ZiG (Dual Display)                           │
│                                                               │
│ Student: [Full Name]        ID: [STU-XXXX]                   │
│ Admission No: [Admission]    Class: [Class]                  │
│ Attendance: [Day/Boarder]    Sponsor: [Regular/BEAM/etc.]    │
│                                                               │
│ Guardian: [Name]             Contact: [Phone]                │
│ Address: [Address]                                           │
│                                                               │
│ ────────────────────────────────────────────────────────────── │
│ Date       │ Ref          │ Description    │ Debit  │ Credit │
│ ────────────────────────────────────────────────────────────── │
│ 01/01/2026 │ BAL-FWD      │ Balance B/F    │ $45.00 │        │
│ 13/01/2026 │ INV-2026-T1  │ Tuition        │ $150.00│        │
│ 13/01/2026 │ INV-2026-T1  │ SDC Levy       │ $200.00│        │
│ 13/01/2026 │ INV-2026-T1  │ Science Prac   │ $25.00 │        │
│ 20/01/2026 │ RCT-88421    │ Bank Deposit   │        │ $200.00│
│ 05/02/2026 │ RCT-89104    │ Cash Office    │        │ $120.00│
│ ────────────────────────────────────────────────────────────── │
│ TOTAL OUTSTANDING BALANCE: $100.00                           │
│                                                               │
│ Fund Summary:                                                │
│   Tuition Balance: $0.00                                     │
│   SDC Levy Balance: $100.00                                  │
│   Prior Period Balance: $0.00                                │
│                                                               │
│ Payment Terms:                                               │
│   Tuition Account: [Nostro/ZiG Account No]                   │
│   SDC Account: [Nostro/ZiG Account No]                       │
│                                                               │
│ [QR CODE FOR VERIFICATION]                                   │
│                                                               │
│ Statement queries: Bursar's Office, [Phone]                 │
│ └─────────────────────────────────────────────────────────────────┘
```

### Appendix C: Sample Payment Voucher Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    [SCHOOL LOGO]                               │
│              [SCHOOL NAME]                                     │
│                                                               │
│                  PAYMENT VOUCHER                              │
│                                                               │
│ PV No: [PV-XXXXX]          Date: [DD/MM/YYYY]               │
│ Fund: [A/B]                Vote: [Vote Code]                 │
│                                                               │
│ Payee: [Supplier Name]      Invoice: [Inv No]                │
│ Address: [Address]          Currency: [USD/ZiG]             │
│                                                               │
│ ────────────────────────────────────────────────────────────── │
│ Description          │ Qty   │ Unit Cost  │ Amount          │
│ ────────────────────────────────────────────────────────────── │
│ [Item 1]             │ [Qty] │ [Unit]     │ $XXX.XX         │
│ [Item 2]             │ [Qty] │ [Unit]     │ $XXX.XX         │
│ ────────────────────────────────────────────────────────────── │
│ TOTAL AMOUNT: $XXX.XX                                         │
│                                                               │
│ Payment Method: [EFT/Cheque/Cash]                            │
│ Bank Account: [Bank Name] [Acc No]                           │
│                                                               │
│ ────────────────────────────────────────────────────────────── │
│ APPROVALS:                                                   │
│                                                               │
│ Requisitioner: ______________ Date: _____                    │
│ Bursar: ____________________ Date: _____                    │
│ SDC Chair/Treasurer: ________ Date: _____                    │
│ School Head: _______________ Date: _____                    │
│ ────────────────────────────────────────────────────────────── │
│                                                               │
│ Attachments: [PRAZ Quotes] [Requisition] [LPO]              │
│                                                               │
│ [QR CODE FOR VERIFICATION]                                   │
│ └─────────────────────────────────────────────────────────────────┘
```

### Appendix D: Database Schema Quick Reference

See full data model documentation in the Data Model Design Document (to be created by development team).

### Appendix E: API Endpoints Summary

See full API documentation in the API Design Document (to be created by development team).

