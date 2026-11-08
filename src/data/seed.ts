import type {
  Alert,
  AuditEntry,
  Currency,
  Dispute,
  Entity,
  ErpSupplier,
  HistoryEntry,
  Invoice,
  InvoiceStatus,
  MatchResult,
  Notification,
  ObligationLump,
  Payment,
  ProgramConfig,
  Rail,
  Supplier,
  User,
} from '../types';
import { quoteFor } from '../logic/pricing';
import { daysBetween, fmtInt, pct } from '../logic/format';

export const TODAY = '2026-11-16';

export const SEED_CONFIG: ProgramConfig = {
  programLimitUSD: 50_000_000,
  spread: 0.0106,
  minInvoiceUSD: 5_000,
  minDaysToDue: 10,
  maxDaysToDue: 180,
  currencies: ['USD', 'EUR', 'MXN', 'CNY', 'SGD'],
  supplierMinMonths: 12,
  supplierMinVolumeUSD: 250_000,
  maxDilution: 0.05,
  unusualSizeMultiple: 3,
  roundFigureThreshold: 250_000,
  roundFigureUnit: 50_000,
  nearLimitPct: 0.02,
  bankChangeDays: 30,
  nearLimitAlertPct: 0.85,
  graceDays: 3,
  lateInterest: 0.02,
};

export const SEED_PROGRAM_USED_USD = 31_000_000;

export const USERS: User[] = [
  { id: 'rachel', name: 'Rachel Kim', portal: 'kaltrex', role: 'CFO', roleKey: 'cfo', companyId: 'KALTREX', userId: 'rachel.kim', approvalLimit: 5_000_000, landing: '/kaltrex/overview', phoneLast4: '4471' },
  { id: 'dana', name: 'Dana Ruiz', portal: 'kaltrex', role: 'Treasurer', roleKey: 'treasurer', companyId: 'KALTREX', userId: 'dana.ruiz', approvalLimit: 1_000_000, landing: '/kaltrex/overview', phoneLast4: '4471' },
  { id: 'mark', name: 'Mark Feld', portal: 'kaltrex', role: 'AP approver', roleKey: 'ap', companyId: 'KALTREX', userId: 'mark.feld', approvalLimit: 250_000, landing: '/kaltrex/approvals', phoneLast4: '4471' },
  { id: 'tom', name: 'Tom Alvarez', portal: 'supplier', role: 'Supplier finance manager', roleKey: 'supplierFinance', companyId: 'MERCER', userId: 'tom.alvarez', supplierId: 'mercer', landing: '/supplier/offered', phoneLast4: '4471' },
  { id: 'lisa', name: 'Lisa Grant', portal: 'supplier', role: 'AR clerk', roleKey: 'arClerk', companyId: 'MERCER', userId: 'lisa.grant', supplierId: 'mercer', landing: '/supplier/invoices', phoneLast4: '4471' },
  { id: 'nora', name: 'Nora Bell', portal: 'supplier', role: 'Owner', roleKey: 'supplierOwner', companyId: 'RIDGEWAY', userId: 'nora.bell', supplierId: 'ridgeway', landing: '/supplier/onboarding', phoneLast4: '4471' },
  { id: 'priya', name: 'Priya Shah', portal: 'bank', role: 'Credit officer', roleKey: 'credit', companyId: 'CORVANE', userId: 'priya.shah', landing: '/bank/onboarding', phoneLast4: '4471' },
  { id: 'ellen', name: 'Ellen Ward', portal: 'bank', role: 'Onboarding officer', roleKey: 'onboarding', companyId: 'CORVANE', userId: 'ellen.ward', landing: '/bank/onboarding', phoneLast4: '4471' },
  { id: 'james', name: 'James Okafor', portal: 'bank', role: 'Operations', roleKey: 'operations', companyId: 'CORVANE', userId: 'james.okafor', landing: '/bank/review', phoneLast4: '4471' },
  { id: 'sam', name: 'Sam Torres', portal: 'bank', role: 'Program admin', roleKey: 'admin', companyId: 'CORVANE', userId: 'sam.torres', landing: '/bank/overview', phoneLast4: '4471' },
];

export const SEED_ENTITIES: Entity[] = [
  { id: 'us', name: 'Kaltrex Industries Inc.', short: 'Industries Inc.', country: 'United States', currency: 'USD', subLimit: 30_000_000 },
  { id: 'de', name: 'Kaltrex GmbH', short: 'GmbH', country: 'Germany', currency: 'EUR', subLimit: 8_000_000 },
  { id: 'mx', name: 'Kaltrex de México', short: 'de México', country: 'Mexico', currency: 'MXN', subLimit: 60_000_000 },
  { id: 'cn', name: 'Kaltrex (Shanghai)', short: 'Shanghai', country: 'China', currency: 'CNY', subLimit: 20_000_000 },
  { id: 'sg', name: 'Kaltrex Asia Pacific', short: 'Asia Pacific', country: 'Singapore', currency: 'SGD', subLimit: 2_000_000 },
];

/** Base obligations (USD millions) by entity and maturity date. Rows sum to 19.3, 6.8, 2.4, 1.7, 0.8. Columns sum to 6.2, 8.1, 4.1, 7.6, 5.0. */
const MATURITY_DATES = ['2026-11-15', '2026-11-30', '2026-12-15', '2026-12-31', '2027-01-15'];
const BASE_MATRIX: Record<string, number[]> = {
  us: [3.9, 5.0, 2.6, 4.6, 3.2],
  de: [1.4, 1.8, 0.9, 1.7, 1.0],
  mx: [0.5, 0.7, 0.3, 0.6, 0.3],
  cn: [0.3, 0.4, 0.2, 0.5, 0.3],
  sg: [0.1, 0.2, 0.1, 0.2, 0.2],
};
export const SEED_OBLIGATIONS: ObligationLump[] = Object.entries(BASE_MATRIX).flatMap(([entityId, row]) =>
  row.map((m, i) => ({ entityId, dueDate: MATURITY_DATES[i], amountUSD: Math.round(m * 1_000_000) })),
);

const passed = (name: string, source: string, detail: string) => ({ name, source, result: 'Passed' as const, detail });

const STANDARD_CHECKS = (owners: number) => [
  passed('Company confirmed in state registry', 'e-KYC registry API', 'Active entity. Name and address match the registration.'),
  passed(`Beneficial owners identified (${owners})`, 'e-KYC, FinCEN CDD rule', `${owners} owners above 25% identified and verified.`),
  passed('Sanctions screening', 'OFAC API', 'No match on SDN or consolidated lists.'),
  passed('Not a related party', 'KYC ownership data', 'No common ownership or directors with Kaltrex.'),
  passed('No competing lien', 'UCC search API', 'No UCC-1 filing against receivables.'),
  passed('Bank account ownership', 'Account verification', 'Account name matches the legal entity.'),
];

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'mercer',
    name: 'Mercer Precision Parts',
    city: 'Dayton, Ohio',
    country: 'United States',
    currency: 'USD',
    payoutCurrency: 'USD',
    kaltrexEntityId: 'us',
    onboardingStatus: 'Enrolled',
    supplierSince: 2014,
    rating: 'A',
    recommendedRating: 'A',
    recommendedSubLimit: 1_500_000,
    approvedSubLimit: 1_500_000,
    subLimitUsed: 287_250,
    bankAccount: { bank: 'Fifth Third Bank', last4: '2290', verified: true },
    checks: STANDARD_CHECKS(2),
    standingInstruction: { on: false, mode: 'All' },
    avgInvoice12m: 150_000,
    invoices12m: 126,
    volume12m: 18_900_000,
    ein: '31-1648820',
    address: '2200 Needmore Road, Dayton, OH 45414',
    stateOfIncorporation: 'Ohio',
    signers: [
      { name: 'Helen Mercer', title: 'President' },
      { name: 'Tom Alvarez', title: 'Finance manager' },
    ],
    owners: [
      { name: 'Helen Mercer', pct: 62 },
      { name: 'Mercer Family Trust', pct: 38 },
    ],
    documents: [
      { name: 'Articles of incorporation.pdf', uploadedOn: '2024-03-02', readBy: 'OCR' },
      { name: 'Signer ID Helen Mercer.pdf', uploadedOn: '2024-03-02', readBy: 'OCR' },
      { name: 'Supplier agreement (signed).pdf', uploadedOn: '2024-03-09' },
    ],
    users: [
      { name: 'Tom Alvarez', role: 'Supplier finance manager' },
      { name: 'Lisa Grant', role: 'AR clerk (view and upload only)' },
    ],
    history: [
      { at: '2024-02-20T10:12:00', by: 'Dana Ruiz', action: 'Nominated by Kaltrex' },
      { at: '2024-03-09T15:30:00', by: 'Credit officer', action: 'Approved. Rating A. Sub-limit USD 1,500,000' },
      { at: '2024-03-11T09:00:00', by: 'System', action: 'Enrolled' },
    ],
  },
  {
    id: 'hauser',
    name: 'Hauser Antriebstechnik GmbH',
    city: 'Stuttgart',
    country: 'Germany',
    currency: 'EUR',
    payoutCurrency: 'EUR',
    kaltrexEntityId: 'de',
    onboardingStatus: 'Enrolled',
    supplierSince: 2016,
    rating: 'A',
    recommendedRating: 'A',
    recommendedSubLimit: 900_000,
    approvedSubLimit: 900_000,
    subLimitUsed: 192_100,
    bankAccount: { bank: 'Deutsche Bank', last4: '7718', verified: true },
    checks: STANDARD_CHECKS(1),
    standingInstruction: { on: true, mode: 'MinDays', value: 20 },
    avgInvoice12m: 140_000,
    invoices12m: 72,
    volume12m: 10_080_000,
    signers: [{ name: 'Katrin Hauser', title: 'Geschäftsführerin' }],
    users: [{ name: 'Jonas Reuter', role: 'Supplier finance manager' }],
    history: [{ at: '2024-06-14T09:00:00', by: 'System', action: 'Enrolled' }],
  },
  {
    id: 'fundiciones',
    name: 'Fundiciones del Norte',
    city: 'Monterrey',
    country: 'Mexico',
    currency: 'MXN',
    payoutCurrency: 'MXN',
    kaltrexEntityId: 'mx',
    onboardingStatus: 'Enrolled',
    supplierSince: 2019,
    rating: 'B',
    recommendedRating: 'B',
    recommendedSubLimit: 12_000_000,
    approvedSubLimit: 12_000_000,
    subLimitUsed: 4_250_000,
    bankAccount: { bank: 'Banorte', last4: '3310', verified: true },
    checks: STANDARD_CHECKS(2),
    standingInstruction: { on: false, mode: 'All' },
    avgInvoice12m: 3_500_000,
    invoices12m: 48,
    volume12m: 168_000_000,
    signers: [{ name: 'Luis Garza', title: 'Director general' }],
    users: [{ name: 'Ana Treviño', role: 'Supplier finance manager' }],
    history: [{ at: '2024-09-02T09:00:00', by: 'System', action: 'Enrolled' }],
  },
  {
    id: 'lianfa',
    name: 'Lianfa Castings Co.',
    city: 'Suzhou',
    country: 'China',
    currency: 'CNY',
    payoutCurrency: 'CNY',
    kaltrexEntityId: 'cn',
    onboardingStatus: 'Enrolled',
    supplierSince: 2020,
    rating: 'B',
    recommendedRating: 'B',
    recommendedSubLimit: 4_000_000,
    approvedSubLimit: 4_000_000,
    subLimitUsed: 2_280_000,
    bankAccount: { bank: 'Bank of China', last4: '9042', verified: true, changedOn: '2026-11-07' },
    checks: STANDARD_CHECKS(1),
    standingInstruction: { on: false, mode: 'All' },
    avgInvoice12m: 1_300_000,
    invoices12m: 60,
    volume12m: 78_000_000,
    signers: [{ name: 'Wei Zhang', title: 'General manager' }],
    users: [{ name: 'Li Na', role: 'Supplier finance manager' }],
    history: [
      { at: '2024-11-20T09:00:00', by: 'System', action: 'Enrolled' },
      { at: '2026-11-07T11:20:00', by: 'Li Na', action: 'Bank account changed', detail: 'Bank of China ···9042. Held for verification.' },
    ],
  },
  {
    id: 'straits',
    name: 'Straits Polymer Pte. Ltd.',
    city: 'Singapore',
    country: 'Singapore',
    currency: 'SGD',
    payoutCurrency: 'SGD',
    kaltrexEntityId: 'sg',
    onboardingStatus: 'Enrolled',
    supplierSince: 2018,
    rating: 'A',
    recommendedRating: 'A',
    recommendedSubLimit: 600_000,
    approvedSubLimit: 600_000,
    subLimitUsed: 522_000,
    bankAccount: { bank: 'DBS Bank', last4: '1187', verified: true },
    checks: STANDARD_CHECKS(1),
    standingInstruction: { on: true, mode: 'All' },
    avgInvoice12m: 80_000,
    invoices12m: 54,
    volume12m: 4_320_000,
    signers: [{ name: 'Mei Lin Tan', title: 'Managing director' }],
    users: [{ name: 'Ravi Menon', role: 'Supplier finance manager' }],
    history: [{ at: '2025-01-10T09:00:00', by: 'System', action: 'Enrolled' }],
  },
  {
    id: 'brennan',
    name: 'Brennan Fastener Supply',
    city: 'Toledo, Ohio',
    country: 'United States',
    currency: 'USD',
    payoutCurrency: 'USD',
    kaltrexEntityId: 'us',
    onboardingStatus: 'Awaiting credit decision',
    stageOwner: 'Priya Shah',
    openedOn: '2026-11-12',
    nominatedOn: '2026-11-12',
    supplierSince: 2017,
    recommendedRating: 'B',
    recommendedSubLimit: 400_000,
    subLimitUsed: 0,
    bankAccount: { bank: 'Huntington National Bank', last4: '6603', verified: true },
    checks: STANDARD_CHECKS(2),
    ratingDetail: [
      {
        no: 1,
        name: 'Relationship history',
        question: 'How long and how steadily has the supplier worked with Kaltrex?',
        score: 'Strong',
        summary: 'Tenure 9 years · USD 2.1M a year · 14 invoices a month · stable',
        metrics: [
          { name: 'Tenure', value: '9 years', source: 'Kaltrex ERP API' },
          { name: 'Annual volume', value: 'USD 2.1M', source: 'Kaltrex ERP API, 24 months' },
          { name: 'Invoices a month', value: '14', source: 'Kaltrex ERP API' },
          { name: 'Volume trend', value: 'Stable (+3% year on year)', source: 'Kaltrex ERP API' },
        ],
      },
      {
        no: 2,
        name: 'Mutual importance',
        question: 'How much does each party depend on the other?',
        score: 'Adequate',
        summary: 'Kaltrex is 31% of supplier revenue · not sole source',
        metrics: [
          { name: 'Kaltrex share of supplier revenue', value: '31%', source: 'Supplier financial statements' },
          { name: 'Sole source for Kaltrex', value: 'No. Two alternative suppliers', source: 'Kaltrex procurement data' },
          { name: 'Share of Kaltrex category spend', value: '18%', source: 'Kaltrex ERP API' },
        ],
      },
      {
        no: 3,
        name: 'Performance quality',
        question: 'Does the supplier deliver what it invoices?',
        score: 'Strong',
        summary: 'Dilution 1.2% · disputes 0.8% · on-time delivery 97%',
        metrics: [
          { name: 'Dilution (credit notes to invoices)', value: '1.2%', source: 'Kaltrex ERP API, 24 months' },
          { name: 'Disputed invoices', value: '0.8%', source: 'Kaltrex AP data' },
          { name: 'On-time delivery', value: '97%', source: 'Kaltrex goods receipt data' },
        ],
      },
      {
        no: 4,
        name: 'Anchor payment behavior',
        question: 'How does Kaltrex treat this supplier?',
        score: 'Strong',
        summary: 'Kaltrex pays on terms · approval lag 6 days',
        metrics: [
          { name: 'Paid on terms', value: '99%', source: 'Kaltrex AP data' },
          { name: 'Approval lag', value: '6 days', source: 'Kaltrex AP data' },
          { name: 'Payment terms', value: '60 days', source: 'Supply contract' },
        ],
      },
      {
        no: 5,
        name: 'Contract strength',
        question: 'How firm is the commercial relationship?',
        score: 'Adequate',
        summary: 'Supply contract 18 months left · terms fixed in contract',
        metrics: [
          { name: 'Contract remaining', value: '18 months', source: 'Supply contract' },
          { name: 'Pricing', value: 'Fixed for the contract term', source: 'Supply contract' },
          { name: 'Minimum volume commitment', value: 'None', source: 'Supply contract' },
        ],
      },
      {
        no: 6,
        name: 'Integrity',
        question: 'Are there signs of error or misuse in the invoices?',
        score: 'Strong',
        summary: 'Match rate 98% · no duplicates · no recent bank change',
        metrics: [
          { name: 'Three-way match rate', value: '98%', source: 'Kaltrex ERP API' },
          { name: 'Duplicate invoices (24 months)', value: '0', source: 'Rules engine' },
          { name: 'Bank account changes (24 months)', value: '0', source: 'Supplier profile' },
        ],
      },
      {
        no: 7,
        name: 'The supplier on its own',
        question: 'Is the supplier itself sound?',
        score: 'Passed',
        summary: 'KYC, sanctions, UCC and financial health all passed',
        metrics: [
          { name: 'KYC and sanctions', value: 'Passed', source: 'e-KYC registry API, OFAC API' },
          { name: 'UCC lien search', value: 'No competing lien', source: 'UCC search API' },
          { name: 'Financial health', value: 'Current ratio 1.6. Debt to equity 0.9', source: 'Supplier financial statements' },
        ],
      },
    ],
    standingInstruction: { on: false, mode: 'All' },
    avgInvoice12m: 12_500,
    invoices12m: 168,
    volume12m: 2_100_000,
    ein: '34-1777210',
    address: '1480 Hill Avenue, Toledo, OH 43607',
    stateOfIncorporation: 'Ohio',
    signers: [
      { name: 'Patrick Brennan', title: 'President' },
      { name: 'Carol Nwosu', title: 'Controller' },
    ],
    owners: [
      { name: 'Patrick Brennan', pct: 55 },
      { name: 'Maureen Brennan', pct: 45 },
    ],
    documents: [
      { name: 'Articles of incorporation.pdf', uploadedOn: '2026-11-13', readBy: 'OCR' },
      { name: 'Signer ID Patrick Brennan.pdf', uploadedOn: '2026-11-13', readBy: 'OCR' },
      { name: 'Signer ID Carol Nwosu.pdf', uploadedOn: '2026-11-13', readBy: 'OCR' },
      { name: 'Bank letter Huntington.pdf', uploadedOn: '2026-11-13' },
    ],
    history: [
      { at: '2026-11-12T10:12:00', by: 'Dana Ruiz', action: 'Nominated by Kaltrex' },
      { at: '2026-11-13T14:05:00', by: 'Patrick Brennan', action: 'Registration submitted' },
      { at: '2026-11-13T14:06:00', by: 'Checks', action: 'All automatic checks passed' },
      { at: '2026-11-13T14:07:00', by: 'Rating model', action: 'Recommendation. Rating B. Sub-limit USD 400,000' },
      { at: '2026-11-13T14:07:00', by: 'System', action: 'Assigned to Priya Shah for credit decision' },
    ],
  },
  {
    id: 'ridgeway',
    name: 'Ridgeway Coatings LLC',
    city: 'Erie, Pennsylvania',
    country: 'United States',
    currency: 'USD',
    payoutCurrency: 'USD',
    kaltrexEntityId: 'us',
    onboardingStatus: 'Checks running',
    stageOwner: 'Ellen Ward',
    openedOn: '2026-11-14',
    nominatedOn: '2026-11-14',
    supplierSince: 2021,
    subLimitUsed: 0,
    bankAccount: { bank: 'PNC Bank', last4: '5521', verified: false },
    checks: [
      passed('Company confirmed in state registry', 'e-KYC registry API', 'Active LLC. Name and address match.'),
      passed('Beneficial owners identified (1)', 'e-KYC, FinCEN CDD rule', 'One owner above 25% identified.'),
      passed('Sanctions screening', 'OFAC API', 'No match on SDN or consolidated lists.'),
      { name: 'No competing lien', source: 'UCC search API', result: 'Running', detail: 'Search in progress' },
      { name: 'Bank account ownership', source: 'Account verification', result: 'Pending', detail: 'Waits for the UCC result' },
    ],
    standingInstruction: { on: false, mode: 'All' },
    avgInvoice12m: 9_800,
    invoices12m: 96,
    volume12m: 940_000,
    ein: '25-1904471',
    address: '3100 West 12th Street, Erie, PA 16505',
    stateOfIncorporation: 'Pennsylvania',
    signers: [{ name: 'Nora Bell', title: 'Owner' }],
    owners: [{ name: 'Nora Bell', pct: 100 }],
    documents: [
      { name: 'Certificate of organization.pdf', uploadedOn: '2026-11-15', readBy: 'OCR' },
      { name: 'Signer ID Nora Bell.pdf', uploadedOn: '2026-11-15', readBy: 'OCR' },
    ],
    users: [{ name: 'Nora Bell', role: 'Owner' }],
    history: [
      { at: '2026-11-14T09:40:00', by: 'Dana Ruiz', action: 'Nominated by Kaltrex' },
      { at: '2026-11-15T16:22:00', by: 'Nora Bell', action: 'Registration submitted' },
      { at: '2026-11-15T16:22:00', by: 'Checks', action: 'Automatic checks started' },
    ],
  },
  {
    id: 'atlas',
    name: 'Atlas Freight Components',
    city: 'Houston, Texas',
    country: 'United States',
    currency: 'USD',
    payoutCurrency: 'USD',
    kaltrexEntityId: 'us',
    onboardingStatus: 'Checks failed',
    stageOwner: 'Ellen Ward',
    openedOn: '2026-11-10',
    nominatedOn: '2026-11-10',
    supplierSince: 2022,
    subLimitUsed: 0,
    bankAccount: { bank: 'Frost Bank', last4: '8814', verified: true },
    checks: [
      passed('Company confirmed in state registry', 'e-KYC registry API', 'Active corporation. Name and address match.'),
      passed('Beneficial owners identified (3)', 'e-KYC, FinCEN CDD rule', 'Three owners above 25% identified.'),
      passed('Sanctions screening', 'OFAC API', 'No match on SDN or consolidated lists.'),
      passed('Not a related party', 'KYC ownership data', 'No common ownership with Kaltrex.'),
      { name: 'No competing lien', source: 'UCC search API', result: 'Failed', detail: 'UCC-1 filed by Gulf Coast Capital on 14 Mar 2026 covering all accounts receivable.' },
      passed('Bank account ownership', 'Account verification', 'Account name matches the legal entity.'),
    ],
    standingInstruction: { on: false, mode: 'All' },
    avgInvoice12m: 21_000,
    invoices12m: 60,
    volume12m: 1_260_000,
    signers: [{ name: 'Derek Hall', title: 'CEO' }],
    history: [
      { at: '2026-11-10T11:00:00', by: 'Dana Ruiz', action: 'Nominated by Kaltrex' },
      { at: '2026-11-11T10:15:00', by: 'Derek Hall', action: 'Registration submitted' },
      { at: '2026-11-11T10:16:00', by: 'Checks', action: 'UCC lien search failed', detail: 'Competing lien on receivables' },
    ],
  },
];

export const ERP_SUPPLIERS: ErpSupplier[] = [
  { id: 'erp-halvorsen', name: 'Halvorsen Bearings Inc.', city: 'Milwaukee, Wisconsin', country: 'United States', currency: 'USD', entityId: 'us', spend12m: 1_640_000, since: 2015 },
  { id: 'erp-pike', name: 'Pike Valley Steel', city: 'Pittsburgh, Pennsylvania', country: 'United States', currency: 'USD', entityId: 'us', spend12m: 3_210_000, since: 2012 },
  { id: 'erp-dorsey', name: 'Dorsey Hydraulics', city: 'Akron, Ohio', country: 'United States', currency: 'USD', entityId: 'us', spend12m: 880_000, since: 2019 },
  { id: 'erp-nordlicht', name: 'Nordlicht Sensorik GmbH', city: 'Hamburg', country: 'Germany', currency: 'EUR', entityId: 'de', spend12m: 1_120_000, since: 2018 },
  { id: 'erp-reyna', name: 'Maquinados Reyna', city: 'Saltillo', country: 'Mexico', currency: 'MXN', entityId: 'mx', spend12m: 24_500_000, since: 2020 },
  { id: 'erp-kestrel', name: 'Kestrel Packaging', city: 'Columbus, Ohio', country: 'United States', currency: 'USD', entityId: 'us', spend12m: 410_000, since: 2023 },
];

type Spec = {
  id?: string;
  number: string;
  supplierId: string;
  entityId: string;
  currency: Currency;
  amount: number;
  invoiceDate: string;
  dueDate: string;
  po: string;
  gr: string;
  match?: MatchResult;
  status: InvoiceStatus;
  reason?: string;
  received: string;
  approvedBy?: string;
  approvedAt?: string;
  routedTo?: string;
  paid?: { at: string; rail: Rail; ref: string; by: string; arrives: string };
  settledOn?: string;
  heldRule?: string;
  disputedBy?: string;
  disputedAt?: string;
  lineItem?: Invoice['lineItem'];
  source?: Invoice['source'];
};

function mk(s: Spec): Invoice {
  const history: HistoryEntry[] = [];
  history.push({ at: s.received, by: s.source === 'PDF upload' ? 'PDF upload' : 'ERP feed', action: 'Received' });
  const match = s.match ?? 'Matched';
  if (s.status === 'Rejected') {
    history.push({ at: s.received, by: 'Rules engine', action: 'Rejected', detail: s.reason });
  } else if (s.status === 'Held') {
    history.push({ at: s.received, by: 'Rules engine', action: 'Validated' });
    history.push({ at: s.received, by: 'Unusual-invoice rules', action: 'Held for review', detail: s.heldRule });
  } else {
    history.push({ at: s.received, by: 'Rules engine', action: 'Validated', detail: match === 'Matched' ? undefined : `${match}. Awaiting credit note.` });
  }
  if (s.routedTo) {
    history.push({ at: s.received, by: 'Routing', action: `Routed to ${s.routedTo}`, detail: 'Above the first approver limit' });
  }
  let quote: Invoice['quote'];
  if (s.approvedAt && s.approvedBy) {
    const q = quoteFor(s.amount, s.currency, s.dueDate, s.approvedAt.slice(0, 10), SEED_CONFIG.spread);
    history.push({ at: s.approvedAt, by: s.approvedBy, action: `Approved. ${s.currency} ${fmtInt(s.amount)}.00. 2FA confirmed` });
    history.push({ at: s.approvedAt, by: 'System', action: `Offered. Rate ${pct(q.rate)}. Net ${s.currency} ${fmtInt(q.netAmount)}` });
  }
  let payment: Payment | undefined;
  if (s.paid) {
    const q = quoteFor(s.amount, s.currency, s.dueDate, s.paid.at.slice(0, 10), SEED_CONFIG.spread);
    quote = { ...q, validUntil: `${s.paid.at.slice(0, 10)}T16:00:00` };
    payment = { rail: s.paid.rail, reference: s.paid.ref, sentAt: s.paid.at, arrivesOn: s.paid.arrives, amount: q.netAmount, currency: s.currency, status: 'Sent' };
    history.push({ at: s.paid.at, by: s.paid.by, action: 'Early payment accepted' });
    history.push({ at: s.paid.at, by: 'Payment hub', action: `Paid early. ${s.paid.rail}. ${s.paid.ref}`, detail: `${s.currency} ${fmtInt(q.netAmount)} to ${s.paid.rail}` });
  }
  if (s.disputedAt && s.disputedBy) {
    history.push({ at: s.disputedAt, by: s.disputedBy, action: 'Dispute raised', detail: s.reason });
  }
  if (s.settledOn) {
    history.push({ at: `${s.settledOn}T06:00:00`, by: 'Settlement', action: `Settled. Kaltrex debited ${s.currency} ${fmtInt(s.amount)}` });
  }
  return {
    id: s.id ?? s.number,
    number: s.number,
    supplierId: s.supplierId,
    entityId: s.entityId,
    currency: s.currency,
    amount: s.amount,
    invoiceDate: s.invoiceDate,
    dueDate: s.dueDate,
    poNumber: s.po,
    grNumber: s.gr,
    match,
    source: s.source ?? 'ERP feed',
    status: s.status,
    reason: s.reason,
    heldRule: s.heldRule,
    heldSince: s.status === 'Held' ? s.received : undefined,
    approvedBy: s.approvedBy,
    approvedAt: s.approvedAt,
    routedTo: s.routedTo,
    lineItem: s.lineItem,
    quote,
    payment,
    settledOn: s.settledOn,
    history,
  };
}

export const SEED_INVOICES: Invoice[] = [
  // Deck invoices (section 8.4)
  mk({
    number: 'OH-48211', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 200_000, invoiceDate: '2026-11-14', dueDate: '2027-01-15',
    po: 'PO-77120', gr: 'GR-55031', status: 'In approval', received: '2026-11-16T09:02:00',
    lineItem: { qty: 400, description: 'Spindle housing', unitPrice: 500, poQty: 400, grQty: 400, grDate: '2026-11-02', grNote: 'Inspected. No rejects' },
  }),
  mk({
    number: 'OH-48190', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 48_200, invoiceDate: '2026-10-31', dueDate: '2026-12-30',
    po: 'PO-77088', gr: 'GR-54990', status: 'Offered', received: '2026-11-02T08:50:00', approvedBy: 'Mark Feld', approvedAt: '2026-11-10T10:12:00',
    lineItem: { qty: 1_205, description: 'Precision shaft 40 mm', unitPrice: 40, poQty: 1_205, grQty: 1_205, grDate: '2026-10-29', grNote: 'Inspected. No rejects' },
  }),
  mk({
    number: 'OH-48225', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 167_900, invoiceDate: '2026-11-13', dueDate: '2027-01-28',
    po: 'PO-77131', gr: 'GR-55040', status: 'Offered', received: '2026-11-14T08:31:00', approvedBy: 'Mark Feld', approvedAt: '2026-11-14T11:05:00',
    lineItem: { qty: 230, description: 'Bearing carrier assembly', unitPrice: 730, poQty: 230, grQty: 230, grDate: '2026-11-12', grNote: 'Inspected. No rejects' },
  }),
  mk({
    number: 'OH-48230', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 22_400, invoiceDate: '2026-11-14', dueDate: '2027-02-12',
    po: 'PO-77140', gr: 'GR-55052', status: 'In approval', received: '2026-11-15T09:10:00',
    lineItem: { qty: 160, description: 'Drive flange', unitPrice: 140, poQty: 160, grQty: 160, grDate: '2026-11-13', grNote: 'Inspected. No rejects' },
  }),
  mk({
    number: 'OH-48198', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 9_850, invoiceDate: '2026-11-05', dueDate: '2026-12-20',
    po: 'PO-77102', gr: 'GR-55004', status: 'Disputed', reason: 'Short delivery. Dispute open.', received: '2026-11-06T09:00:00',
    approvedBy: 'Mark Feld', approvedAt: '2026-11-09T14:20:00', disputedBy: 'Mark Feld', disputedAt: '2026-11-12T15:02:00',
    lineItem: { qty: 200, description: 'Mounting bracket', unitPrice: 49.25, poQty: 200, grQty: 180, grDate: '2026-11-04', grNote: '180 received. 20 short' },
  }),
  mk({
    number: 'OH-48102', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 61_300, invoiceDate: '2026-09-30', dueDate: '2026-12-01',
    po: 'PO-77010', gr: 'GR-54890', status: 'Paid early', received: '2026-10-01T08:40:00', approvedBy: 'Mark Feld', approvedAt: '2026-10-01T15:30:00',
    paid: { at: '2026-10-02T10:14:00', rail: 'ACH', ref: 'CVB-ACH-2026100201', by: 'Tom Alvarez', arrives: '2026-10-05' },
    lineItem: { qty: 613, description: 'Gear blank 120 mm', unitPrice: 100, poQty: 613, grQty: 613, grDate: '2026-09-29', grNote: 'Inspected. No rejects' },
  }),
  mk({
    number: 'OH-47950', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 54_000, invoiceDate: '2026-09-02', dueDate: '2026-11-01',
    po: 'PO-76940', gr: 'GR-54802', status: 'Settled', received: '2026-09-03T08:40:00', approvedBy: 'Mark Feld', approvedAt: '2026-09-04T10:00:00',
    paid: { at: '2026-09-10T09:30:00', rail: 'ACH', ref: 'CVB-ACH-2026091001', by: 'Tom Alvarez', arrives: '2026-09-11' }, settledOn: '2026-11-01',
  }),
  mk({
    number: 'DE-10377', supplierId: 'hauser', entityId: 'de', currency: 'EUR', amount: 150_000, invoiceDate: '2026-11-12', dueDate: '2027-01-20',
    po: 'PO-DE-3310', gr: 'GR-DE-2201', status: 'In approval', received: '2026-11-13T07:15:00',
    lineItem: { qty: 60, description: 'Servo gearbox SG-220', unitPrice: 2_500, poQty: 60, grQty: 60, grDate: '2026-11-11', grNote: 'Inspected. No rejects' },
  }),
  mk({
    number: 'DE-10341', supplierId: 'hauser', entityId: 'de', currency: 'EUR', amount: 82_500, invoiceDate: '2026-10-19', dueDate: '2026-12-18',
    po: 'PO-DE-3287', gr: 'GR-DE-2174', status: 'Paid early', reason: 'Defective parts. Dispute open.', received: '2026-10-20T07:10:00', approvedBy: 'Dana Ruiz', approvedAt: '2026-10-27T09:45:00',
    paid: { at: '2026-10-28T08:05:00', rail: 'SEPA', ref: 'CVB-SEPA-2026102801', by: 'Jonas Reuter', arrives: '2026-10-29' },
    disputedBy: 'Dana Ruiz', disputedAt: '2026-11-13T10:30:00',
    lineItem: { qty: 150, description: 'Gearbox housing GH-80', unitPrice: 550, poQty: 150, grQty: 150, grDate: '2026-10-18', grNote: 'Inspected. No rejects at receipt' },
  }),
  mk({
    number: 'MX-22904', supplierId: 'fundiciones', entityId: 'mx', currency: 'MXN', amount: 3_100_000, invoiceDate: '2026-11-10', dueDate: '2027-01-09',
    po: 'PO-MX-8821', gr: 'GR-MX-5508', match: 'Quantity variance', status: 'In approval', reason: 'Quantity variance. Awaiting credit note.', received: '2026-11-11T09:30:00',
    lineItem: { qty: 1_200, description: 'Cast housing CH-12', unitPrice: 2_583.33, poQty: 1_200, grQty: 1_150, grDate: '2026-11-09', grNote: '1,150 received. 50 short' },
  }),
  mk({
    number: 'CN-55120', supplierId: 'lianfa', entityId: 'cn', currency: 'CNY', amount: 1_250_000, invoiceDate: '2026-11-13', dueDate: '2027-02-03',
    po: 'PO-CN-4410', gr: 'GR-CN-3302', status: 'Held', heldRule: 'Supplier bank account changed 9 days ago (within 30 days)', reason: 'Supplier bank account changed 9 days ago', received: '2026-11-15T03:20:00',
    lineItem: { qty: 500, description: 'Iron casting IC-44', unitPrice: 2_500, poQty: 500, grQty: 500, grDate: '2026-11-12', grNote: 'Inspected. No rejects' },
  }),
  mk({
    number: 'SG-30418', supplierId: 'straits', entityId: 'sg', currency: 'SGD', amount: 96_000, invoiceDate: '2026-11-12', dueDate: '2027-01-22',
    po: 'PO-SG-1190', gr: 'GR-SG-0871', status: 'Offered', received: '2026-11-13T02:00:00', approvedBy: 'Rachel Kim', approvedAt: '2026-11-14T08:12:00',
    lineItem: { qty: 4_000, description: 'Polymer seal kit', unitPrice: 24, poQty: 4_000, grQty: 4_000, grDate: '2026-11-11', grNote: 'Inspected. No rejects' },
  }),
  mk({
    number: 'OH-48240', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 410_000, invoiceDate: '2026-11-14', dueDate: '2027-02-05',
    po: 'PO-77145', gr: 'GR-55060', status: 'In approval', received: '2026-11-15T09:12:00',
    lineItem: { qty: 820, description: 'Spindle housing (large)', unitPrice: 500, poQty: 820, grQty: 820, grDate: '2026-11-13', grNote: 'Inspected. No rejects' },
  }),

  // More invoices so tables look real
  mk({ number: 'OH-48215', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 36_750, invoiceDate: '2026-11-13', dueDate: '2027-01-19', po: 'PO-77124', gr: 'GR-55034', status: 'In approval', received: '2026-11-14T09:05:00' }),
  mk({ number: 'OH-48219', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 44_100, invoiceDate: '2026-11-13', dueDate: '2027-01-25', po: 'PO-77127', gr: 'GR-55037', status: 'In approval', received: '2026-11-14T09:06:00' }),
  mk({ number: 'OH-48233', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 57_300, invoiceDate: '2026-11-15', dueDate: '2027-02-09', po: 'PO-77142', gr: 'GR-55055', status: 'In approval', received: '2026-11-16T09:01:00' }),
  mk({ number: 'OH-48195', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 26_500, invoiceDate: '2026-11-04', dueDate: '2026-12-24', po: 'PO-77099', gr: 'GR-55001', status: 'In approval', received: '2026-11-14T08:20:00' }),
  mk({ number: 'OH-47980', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 72_400, invoiceDate: '2026-09-06', dueDate: '2026-11-05', po: 'PO-76951', gr: 'GR-54810', status: 'Settled', received: '2026-09-07T08:40:00', approvedBy: 'Mark Feld', approvedAt: '2026-09-08T10:00:00', paid: { at: '2026-09-12T09:30:00', rail: 'ACH', ref: 'CVB-ACH-2026091201', by: 'Tom Alvarez', arrives: '2026-09-14' }, settledOn: '2026-11-05' }),
  mk({ number: 'OH-47912', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 128_600, invoiceDate: '2026-08-21', dueDate: '2026-10-20', po: 'PO-76902', gr: 'GR-54770', status: 'Settled', received: '2026-08-22T08:40:00', approvedBy: 'Mark Feld', approvedAt: '2026-08-25T10:00:00', paid: { at: '2026-09-01T09:30:00', rail: 'ACH', ref: 'CVB-ACH-2026090101', by: 'Tom Alvarez', arrives: '2026-09-02' }, settledOn: '2026-10-20' }),
  mk({ number: 'OH-47712', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 31_200, invoiceDate: '2026-08-04', dueDate: '2026-10-05', po: 'PO-76850', gr: 'GR-54711', status: 'Settled', received: '2026-08-05T08:40:00', approvedBy: 'Mark Feld', approvedAt: '2026-08-06T10:00:00', settledOn: '2026-10-05' }),
  mk({ id: 'OH-47712-dup', number: 'OH-47712', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 31_200, invoiceDate: '2026-08-04', dueDate: '2026-10-05', po: 'PO-76850', gr: 'GR-54711', status: 'Rejected', reason: 'Duplicate of OH-47712', received: '2026-08-19T08:40:00', source: 'PDF upload' }),
  mk({ number: 'OH-48177', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 4_200, invoiceDate: '2026-10-22', dueDate: '2026-12-22', po: 'PO-77070', gr: 'GR-54975', status: 'Rejected', reason: 'Below program minimum', received: '2026-10-23T08:40:00' }),
  mk({ number: 'OH-48201', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 88_000, invoiceDate: '2026-11-06', dueDate: '2027-06-30', po: 'PO-77108', gr: 'GR-55010', status: 'Rejected', reason: 'Due date beyond 180 days', received: '2026-11-07T08:40:00' }),
  mk({ number: 'DE-10360', supplierId: 'hauser', entityId: 'de', currency: 'EUR', amount: 64_000, invoiceDate: '2026-11-06', dueDate: '2027-01-08', po: 'PO-DE-3301', gr: 'GR-DE-2190', status: 'Offered', received: '2026-11-07T07:15:00', approvedBy: 'Dana Ruiz', approvedAt: '2026-11-12T09:45:00' }),
  mk({ number: 'DE-10352', supplierId: 'hauser', entityId: 'de', currency: 'EUR', amount: 418_250, invoiceDate: '2026-10-29', dueDate: '2026-12-30', po: 'PO-DE-3296', gr: 'GR-DE-2183', status: 'In approval', received: '2026-11-14T07:15:00' }),
  mk({ number: 'DE-10381', supplierId: 'hauser', entityId: 'de', currency: 'EUR', amount: 37_800, invoiceDate: '2026-11-14', dueDate: '2027-02-04', po: 'PO-DE-3315', gr: 'GR-DE-2206', status: 'In approval', received: '2026-11-15T07:15:00' }),
  mk({ number: 'DE-10298', supplierId: 'hauser', entityId: 'de', currency: 'EUR', amount: 91_000, invoiceDate: '2026-09-10', dueDate: '2026-11-10', po: 'PO-DE-3250', gr: 'GR-DE-2140', status: 'Settled', received: '2026-09-11T07:15:00', approvedBy: 'Dana Ruiz', approvedAt: '2026-09-15T09:45:00', paid: { at: '2026-09-16T08:05:00', rail: 'SEPA', ref: 'CVB-SEPA-2026091601', by: 'Standing instruction', arrives: '2026-09-17' }, settledOn: '2026-11-10' }),
  mk({ number: 'DE-10310', supplierId: 'hauser', entityId: 'de', currency: 'EUR', amount: 45_600, invoiceDate: '2026-10-06', dueDate: '2026-12-05', po: 'PO-DE-3264', gr: 'GR-DE-2152', status: 'Paid early', received: '2026-10-07T07:15:00', approvedBy: 'Dana Ruiz', approvedAt: '2026-10-19T09:45:00', paid: { at: '2026-10-20T08:05:00', rail: 'SEPA', ref: 'CVB-SEPA-2026102001', by: 'Standing instruction', arrives: '2026-10-21' } }),
  mk({ number: 'MX-22880', supplierId: 'fundiciones', entityId: 'mx', currency: 'MXN', amount: 1_850_000, invoiceDate: '2026-10-29', dueDate: '2026-12-28', po: 'PO-MX-8802', gr: 'GR-MX-5490', status: 'Offered', received: '2026-10-30T09:30:00', approvedBy: 'Rachel Kim', approvedAt: '2026-11-05T08:12:00' }),
  mk({ number: 'MX-22871', supplierId: 'fundiciones', entityId: 'mx', currency: 'MXN', amount: 2_400_000, invoiceDate: '2026-10-16', dueDate: '2026-12-15', po: 'PO-MX-8790', gr: 'GR-MX-5481', status: 'Paid early', received: '2026-10-17T09:30:00', approvedBy: 'Rachel Kim', approvedAt: '2026-11-02T08:12:00', paid: { at: '2026-11-03T10:00:00', rail: 'SWIFT', ref: 'CVB-SWIFT-2026110301', by: 'Ana Treviño', arrives: '2026-11-05' } }),
  mk({ number: 'MX-22790', supplierId: 'fundiciones', entityId: 'mx', currency: 'MXN', amount: 1_950_000, invoiceDate: '2026-09-03', dueDate: '2026-11-02', po: 'PO-MX-8720', gr: 'GR-MX-5410', status: 'Settled', received: '2026-09-04T09:30:00', approvedBy: 'Rachel Kim', approvedAt: '2026-09-08T08:12:00', paid: { at: '2026-09-09T10:00:00', rail: 'SWIFT', ref: 'CVB-SWIFT-2026090901', by: 'Ana Treviño', arrives: '2026-09-11' }, settledOn: '2026-11-02' }),
  mk({ number: 'MX-22915', supplierId: 'fundiciones', entityId: 'mx', currency: 'MXN', amount: 9_800_000, invoiceDate: '2026-11-13', dueDate: '2027-01-30', po: 'PO-MX-8830', gr: 'GR-MX-5515', status: 'In approval', received: '2026-11-14T09:30:00' }),
  mk({ number: 'CN-55098', supplierId: 'lianfa', entityId: 'cn', currency: 'CNY', amount: 860_000, invoiceDate: '2026-10-23', dueDate: '2026-12-22', po: 'PO-CN-4390', gr: 'GR-CN-3285', status: 'Offered', received: '2026-10-24T03:20:00', approvedBy: 'Rachel Kim', approvedAt: '2026-10-30T08:12:00' }),
  mk({ number: 'CN-55075', supplierId: 'lianfa', entityId: 'cn', currency: 'CNY', amount: 1_420_000, invoiceDate: '2026-10-09', dueDate: '2026-12-08', po: 'PO-CN-4371', gr: 'GR-CN-3270', status: 'Paid early', received: '2026-10-10T03:20:00', approvedBy: 'Rachel Kim', approvedAt: '2026-10-28T08:12:00', paid: { at: '2026-10-29T04:00:00', rail: 'SWIFT', ref: 'CVB-SWIFT-2026102901', by: 'Li Na', arrives: '2026-11-02' } }),
  mk({ number: 'CN-54990', supplierId: 'lianfa', entityId: 'cn', currency: 'CNY', amount: 1_100_000, invoiceDate: '2026-08-29', dueDate: '2026-10-28', po: 'PO-CN-4300', gr: 'GR-CN-3201', status: 'Settled', received: '2026-08-30T03:20:00', approvedBy: 'Rachel Kim', approvedAt: '2026-09-02T08:12:00', paid: { at: '2026-09-03T04:00:00', rail: 'SWIFT', ref: 'CVB-SWIFT-2026090301', by: 'Li Na', arrives: '2026-09-07' }, settledOn: '2026-10-28' }),
  mk({ number: 'CN-55131', supplierId: 'lianfa', entityId: 'cn', currency: 'CNY', amount: 3_640_000, invoiceDate: '2026-11-14', dueDate: '2027-02-15', po: 'PO-CN-4418', gr: 'GR-CN-3310', status: 'In approval', received: '2026-11-15T03:25:00' }),
  mk({ number: 'SG-30402', supplierId: 'straits', entityId: 'sg', currency: 'SGD', amount: 142_000, invoiceDate: '2026-10-19', dueDate: '2026-12-18', po: 'PO-SG-1175', gr: 'GR-SG-0860', status: 'Paid early', received: '2026-10-20T02:00:00', approvedBy: 'Rachel Kim', approvedAt: '2026-11-04T08:12:00', paid: { at: '2026-11-05T02:30:00', rail: 'SWIFT', ref: 'CVB-SWIFT-2026110501', by: 'Standing instruction', arrives: '2026-11-09' } }),
  mk({ number: 'SG-30395', supplierId: 'straits', entityId: 'sg', currency: 'SGD', amount: 88_500, invoiceDate: '2026-10-11', dueDate: '2026-12-10', po: 'PO-SG-1168', gr: 'GR-SG-0852', status: 'Offered', received: '2026-10-12T02:00:00', approvedBy: 'Rachel Kim', approvedAt: '2026-11-15T08:12:00' }),
  mk({ number: 'SG-30377', supplierId: 'straits', entityId: 'sg', currency: 'SGD', amount: 71_200, invoiceDate: '2026-09-13', dueDate: '2026-11-12', po: 'PO-SG-1150', gr: 'GR-SG-0831', status: 'Settled', received: '2026-09-14T02:00:00', approvedBy: 'Rachel Kim', approvedAt: '2026-09-16T08:12:00', paid: { at: '2026-09-17T02:30:00', rail: 'SWIFT', ref: 'CVB-SWIFT-2026091701', by: 'Standing instruction', arrives: '2026-09-21' }, settledOn: '2026-11-12' }),
  mk({ number: 'SG-30425', supplierId: 'straits', entityId: 'sg', currency: 'SGD', amount: 54_000, invoiceDate: '2026-11-14', dueDate: '2027-02-01', po: 'PO-SG-1196', gr: 'GR-SG-0878', status: 'In approval', received: '2026-11-15T02:00:00' }),
];

export const SEED_DISPUTES: Dispute[] = [
  {
    id: 'D-1041',
    invoiceId: 'OH-48198',
    raisedBy: 'Mark Feld',
    raisedByParty: 'Kaltrex',
    raisedAt: '2026-11-12T15:02:00',
    reason: 'Short delivery',
    text: 'Goods receipt GR-55004 shows 180 of 200 mounting brackets received. The invoice is for 200.',
    documents: ['GR-55004 delivery note.pdf'],
    paidEarly: false,
    status: 'Open',
    messages: [
      { at: '2026-11-12T15:02:00', by: 'Mark Feld', party: 'Kaltrex', text: 'Goods receipt GR-55004 shows 180 of 200 mounting brackets received. The invoice is for 200.', attachments: ['GR-55004 delivery note.pdf'] },
      { at: '2026-11-13T09:40:00', by: 'Tom Alvarez', party: 'Supplier', text: 'Checking with the warehouse. The remaining 20 shipped on 11 Nov. A credit note follows if they are not received this week.' },
    ],
    history: [{ at: '2026-11-12T15:02:00', by: 'Mark Feld', action: 'Dispute raised', detail: 'Short delivery' }],
  },
  {
    id: 'D-1043',
    invoiceId: 'DE-10341',
    raisedBy: 'Dana Ruiz',
    raisedByParty: 'Kaltrex',
    raisedAt: '2026-11-13T10:30:00',
    reason: 'Defective parts',
    text: '12 of 150 gearbox housings failed inspection after installation. Inspection report attached.',
    documents: ['Inspection report DE-10341.pdf', 'Photos DE-10341.zip'],
    paidEarly: true,
    status: 'Open',
    messages: [
      { at: '2026-11-13T10:30:00', by: 'Dana Ruiz', party: 'Kaltrex', text: '12 of 150 gearbox housings failed inspection after installation. Inspection report attached.', attachments: ['Inspection report DE-10341.pdf', 'Photos DE-10341.zip'] },
      { at: '2026-11-13T16:10:00', by: 'Jonas Reuter', party: 'Supplier', text: 'Received. Quality is reviewing the report. Replacement units can ship next week.' },
    ],
    history: [{ at: '2026-11-13T10:30:00', by: 'Dana Ruiz', action: 'Dispute raised', detail: 'Defective parts. Invoice already paid early.' }],
  },
  {
    id: 'D-1032',
    invoiceId: 'OH-47912',
    raisedBy: 'Mark Feld',
    raisedByParty: 'Kaltrex',
    raisedAt: '2026-09-15T11:00:00',
    reason: 'Price difference',
    text: 'Unit price on the invoice is USD 2.00 above the PO price on 1,400 units.',
    documents: ['PO-76902.pdf'],
    paidEarly: true,
    status: 'Resolved',
    resolution: 'Credit note',
    resolvedAt: '2026-09-22T14:00:00',
    messages: [
      { at: '2026-09-15T11:00:00', by: 'Mark Feld', party: 'Kaltrex', text: 'Unit price on the invoice is USD 2.00 above the PO price on 1,400 units.', attachments: ['PO-76902.pdf'] },
      { at: '2026-09-17T09:00:00', by: 'Tom Alvarez', party: 'Supplier', text: 'Agreed. Credit note CN-1180 for USD 2,800 issued against the next invoice.' },
    ],
    history: [
      { at: '2026-09-15T11:00:00', by: 'Mark Feld', action: 'Dispute raised', detail: 'Price difference' },
      { at: '2026-09-22T14:00:00', by: 'Mark Feld', action: 'Resolved. Credit note', detail: 'CN-1180 USD 2,800' },
    ],
  },
];

export const SEED_ALERTS: Alert[] = [
  {
    id: 'AL-201',
    type: 'Bank account changed',
    subject: 'Lianfa Castings Co.',
    detail: 'Payout account changed to Bank of China ···9042 on 7 Nov 2026. Invoices paid to this account are held for review for 30 days. CN-55120 is held.',
    raisedAt: '2026-11-07T11:21:00',
    owner: 'Operations',
    status: 'Open',
    notes: [{ at: '2026-11-08T09:00:00', by: 'James Okafor', text: 'Call-back to the registered phone number scheduled.' }],
  },
  {
    id: 'AL-198',
    type: 'Limit nearly used',
    subject: 'Straits Polymer Pte. Ltd.',
    detail: 'Sub-limit 87% used (SGD 522,000 of SGD 600,000). Threshold is 85%.',
    raisedAt: '2026-11-10T06:00:00',
    owner: 'Credit',
    status: 'Open',
    notes: [],
  },
  {
    id: 'AL-195',
    type: 'Volume falling',
    subject: 'Fundiciones del Norte',
    detail: 'Invoice volume over the last 3 months is 28% below the 12-month average.',
    raisedAt: '2026-11-03T06:00:00',
    owner: 'Credit',
    status: 'Open',
    notes: [{ at: '2026-11-04T10:30:00', by: 'Priya Shah', text: 'Kaltrex de México confirms a seasonal production pause in Monterrey. Review again in January.' }],
  },
  {
    id: 'AL-190',
    type: 'Dilution',
    subject: 'Lianfa Castings Co.',
    detail: 'Dilution 5.4% over 90 days against a 5.0% maximum. Credit notes relate to one disputed shipment.',
    raisedAt: '2026-10-22T06:00:00',
    owner: 'Credit',
    status: 'Closed',
    notes: [{ at: '2026-10-24T15:00:00', by: 'Priya Shah', text: 'One-off. Dilution back to 1.9% after the shipment. No change to the sub-limit.' }],
  },
];

export const SEED_AUDIT: AuditEntry[] = [
  { id: 'a-1', at: '2026-11-10T10:12:00', user: 'Mark Feld', role: 'AP approver', action: 'Approved invoice', object: 'OH-48190', detail: 'USD 48,200.00. 2FA confirmed. Offered to Mercer Precision Parts' },
  { id: 'a-2', at: '2026-11-12T10:12:00', user: 'Dana Ruiz', role: 'Treasurer', action: 'Nominated supplier', object: 'Brennan Fastener Supply', detail: 'From Kaltrex supplier list in its ERP' },
  { id: 'a-3', at: '2026-11-12T15:02:00', user: 'Mark Feld', role: 'AP approver', action: 'Raised dispute', object: 'OH-48198', detail: 'Short delivery. D-1041' },
  { id: 'a-4', at: '2026-11-13T10:30:00', user: 'Dana Ruiz', role: 'Treasurer', action: 'Raised dispute', object: 'DE-10341', detail: 'Defective parts. D-1043. Invoice already paid early' },
  { id: 'a-5', at: '2026-11-13T14:07:00', user: 'Rating model', role: 'System', action: 'Recommendation', object: 'Brennan Fastener Supply', detail: 'Rating B. Sub-limit USD 400,000. Awaiting credit officer decision' },
  { id: 'a-6', at: '2026-11-14T08:12:00', user: 'Rachel Kim', role: 'CFO', action: 'Approved invoice', object: 'SG-30418', detail: 'SGD 96,000.00. 2FA confirmed' },
  { id: 'a-7', at: '2026-11-14T09:40:00', user: 'Dana Ruiz', role: 'Treasurer', action: 'Nominated supplier', object: 'Ridgeway Coatings LLC', detail: 'From Kaltrex supplier list in its ERP' },
  { id: 'a-8', at: '2026-11-14T11:05:00', user: 'Mark Feld', role: 'AP approver', action: 'Approved invoice', object: 'OH-48225', detail: 'USD 167,900.00. 2FA confirmed. Offered to Mercer Precision Parts' },
  { id: 'a-9', at: '2026-11-15T03:20:00', user: 'Unusual-invoice rules', role: 'System', action: 'Held invoice for review', object: 'CN-55120', detail: 'Supplier bank account changed 9 days ago (within 30 days)' },
  { id: 'a-10', at: '2026-11-15T08:12:00', user: 'Rachel Kim', role: 'CFO', action: 'Approved invoice', object: 'SG-30395', detail: 'SGD 88,500.00. 2FA confirmed' },
  { id: 'a-11', at: '2026-11-15T16:22:00', user: 'Nora Bell', role: 'Supplier owner', action: 'Submitted registration', object: 'Ridgeway Coatings LLC', detail: 'Four-step registration. Automatic checks started' },
  { id: 'a-12', at: '2026-11-16T07:00:00', user: 'Sam Torres', role: 'Program admin', action: 'Viewed program configuration', object: 'Program configuration', detail: 'No change' },
  { id: 'a-13', at: '2026-11-16T09:02:00', user: 'ERP feed', role: 'System', action: 'Received invoice', object: 'OH-48211', detail: 'USD 200,000.00. Validated. All acceptance criteria passed' },
];

export const SEED_NOTIFICATIONS: Notification[] = [
  { id: 'n-1', portal: 'kaltrex', at: '2026-11-15T03:20:00', text: 'CN-55120 held for review by the bank. Supplier bank account changed recently.', link: '/kaltrex/invoices/CN-55120', read: true },
  { id: 'n-2', portal: 'kaltrex', at: '2026-11-13T16:10:00', text: 'Hauser Antriebstechnik replied on dispute D-1043.', link: '/kaltrex/disputes/D-1043', read: true },
  { id: 'n-3', portal: 'kaltrex', at: '2026-11-16T09:02:00', text: '3 new invoices from Mercer Precision Parts are waiting for approval.', link: '/kaltrex/approvals', read: false },
  { id: 'n-4', portal: 'supplier:mercer', at: '2026-11-14T11:05:00', text: 'OH-48225 approved by Kaltrex and offered to you.', link: '/supplier/offered', read: true },
  { id: 'n-5', portal: 'supplier:mercer', at: '2026-11-12T15:02:00', text: 'Kaltrex raised dispute D-1041 on OH-48198.', link: '/supplier/disputes/D-1041', read: true },
  { id: 'n-6', portal: 'bank', at: '2026-11-15T03:20:00', text: 'CN-55120 held for review. Supplier bank account changed 9 days ago.', link: '/bank/review', read: false },
  { id: 'n-7', portal: 'bank', at: '2026-11-13T14:07:00', text: 'Brennan Fastener Supply is waiting for a credit decision.', link: '/bank/onboarding/brennan', read: true },
];

export function daysToDue(dueDate: string, today = TODAY): number {
  return daysBetween(today, dueDate);
}
