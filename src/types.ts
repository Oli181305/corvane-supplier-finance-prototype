export type Currency = 'USD' | 'EUR' | 'MXN' | 'CNY' | 'SGD';

export type Entity = {
  id: string;
  name: string;
  short: string;
  country: string;
  currency: Currency;
  subLimit: number;
};

export type OnboardingStatus =
  | 'Nominated'
  | 'Registering'
  | 'Checks running'
  | 'Checks failed'
  | 'Awaiting credit decision'
  | 'Awaiting signature'
  | 'Enrolled'
  | 'Declined';

export type CheckResult = 'Passed' | 'Failed' | 'Review' | 'Running' | 'Pending';

export type SupplierCheck = { name: string; source: string; result: CheckResult; detail: string };

export type RatingScore = 'Strong' | 'Adequate' | 'Weak' | 'Passed';

export type RatingCategory = {
  no: number;
  name: string;
  question: string;
  metrics: { name: string; value: string; source: string }[];
  score: RatingScore;
  summary: string;
};

export type StandingInstruction = {
  on: boolean;
  mode: 'All' | 'AboveAmount' | 'MinDays' | 'WeeklyAmount';
  value?: number;
};

export type Supplier = {
  id: string;
  name: string;
  city: string;
  country: string;
  currency: Currency;
  payoutCurrency: Currency;
  kaltrexEntityId: string;
  onboardingStatus: OnboardingStatus;
  stageOwner?: string;
  openedOn?: string;
  nominatedOn?: string;
  supplierSince?: number;
  rating?: 'A' | 'B' | 'C';
  recommendedRating?: 'A' | 'B' | 'C';
  recommendedSubLimit?: number;
  approvedSubLimit?: number;
  subLimitUsed: number;
  bankAccount: { bank: string; last4: string; verified: boolean; changedOn?: string };
  pendingBankAccount?: { bank: string; last4: string; changedOn: string };
  checks: SupplierCheck[];
  ratingDetail?: RatingCategory[];
  standingInstruction: StandingInstruction;
  avgInvoice12m: number;
  invoices12m: number;
  volume12m: number;
  ein?: string;
  address?: string;
  stateOfIncorporation?: string;
  signers?: { name: string; title: string }[];
  owners?: { name: string; pct: number }[];
  documents?: { name: string; uploadedOn: string; readBy?: string }[];
  users?: { name: string; role: string }[];
  history: HistoryEntry[];
};

export type InvoiceStatus =
  | 'Received'
  | 'Validated'
  | 'Held'
  | 'In approval'
  | 'Approved'
  | 'Offered'
  | 'Paid early'
  | 'Disputed'
  | 'Settled'
  | 'Rejected';

export type MatchResult = 'Matched' | 'Quantity variance' | 'Price variance' | 'No goods receipt';

export type HistoryEntry = { at: string; by: string; action: string; detail?: string };

export type Quote = {
  rate: number;
  marketRate: number;
  marketRateName: string;
  spread: number;
  days: number;
  discount: number;
  netAmount: number;
  validUntil: string;
  fxRate?: number;
  payoutCurrency?: Currency;
  payoutAmount?: number;
};

export type Rail = 'ACH' | 'Fedwire' | 'SWIFT' | 'SEPA' | 'FAST';

export type Payment = {
  rail: Rail;
  reference: string;
  sentAt: string;
  arrivesOn: string;
  amount: number;
  currency: Currency;
  status: 'Sent' | 'Returned';
};

export type CriteriaResult = { name: string; result: 'Passed' | 'Failed' | 'Variance'; detail: string };

export type Invoice = {
  id: string;
  number: string;
  supplierId: string;
  entityId: string;
  currency: Currency;
  amount: number;
  invoiceDate: string;
  dueDate: string;
  poNumber: string;
  grNumber: string;
  match: MatchResult;
  source: 'ERP feed' | 'PDF upload';
  status: InvoiceStatus;
  reason?: string;
  heldRule?: string;
  heldSince?: string;
  approvedBy?: string;
  approvedAt?: string;
  routedTo?: string;
  creditNote?: number;
  lineItem?: {
    qty: number;
    description: string;
    unitPrice: number;
    poQty?: number;
    grQty?: number;
    grDate?: string;
    grNote?: string;
  };
  quote?: Quote;
  payment?: Payment;
  settledOn?: string;
  history: HistoryEntry[];
};

export type DisputeReason = 'Short delivery' | 'Defective parts' | 'Price difference' | 'Other';

export type DisputeMessage = {
  at: string;
  by: string;
  party: 'Kaltrex' | 'Supplier' | 'Bank';
  text: string;
  attachments?: string[];
};

export type Dispute = {
  id: string;
  invoiceId: string;
  raisedBy: string;
  raisedByParty: 'Kaltrex' | 'Supplier';
  raisedAt: string;
  reason: DisputeReason;
  text: string;
  documents: string[];
  paidEarly: boolean;
  status: 'Open' | 'Resolved';
  resolution?: 'Credit note' | 'Corrected invoice' | 'Amount confirmed';
  resolvedAt?: string;
  messages: DisputeMessage[];
  history: HistoryEntry[];
};

export type AlertType =
  | 'Dilution'
  | 'Volume falling'
  | 'Limit nearly used'
  | 'Rating change'
  | 'Payment not received'
  | 'Bank account changed';

export type Alert = {
  id: string;
  type: AlertType;
  subject: string;
  detail: string;
  raisedAt: string;
  owner: 'Credit' | 'Operations';
  status: 'Open' | 'Closed';
  notes: { at: string; by: string; text: string }[];
  caseId?: string;
};

export type AuditEntry = {
  id: string;
  at: string;
  user: string;
  role: string;
  action: string;
  object: string;
  detail: string;
};

export type Notification = {
  id: string;
  portal: string; // 'kaltrex' | 'bank' | 'supplier:<id>'
  at: string;
  text: string;
  link: string;
  read: boolean;
};

export type ProgramConfig = {
  programLimitUSD: number;
  spread: number;
  minInvoiceUSD: number;
  minDaysToDue: number;
  maxDaysToDue: number;
  currencies: Currency[];
  supplierMinMonths: number;
  supplierMinVolumeUSD: number;
  maxDilution: number;
  unusualSizeMultiple: number;
  roundFigureThreshold: number;
  roundFigureUnit: number;
  nearLimitPct: number;
  bankChangeDays: number;
  nearLimitAlertPct: number;
  graceDays: number;
  lateInterest: number;
};

export type Portal = 'kaltrex' | 'supplier' | 'bank';

export type RoleKey =
  | 'cfo'
  | 'treasurer'
  | 'ap'
  | 'supplierFinance'
  | 'arClerk'
  | 'supplierOwner'
  | 'credit'
  | 'onboarding'
  | 'operations'
  | 'admin';

export type User = {
  id: string;
  name: string;
  portal: Portal;
  role: string;
  roleKey: RoleKey;
  companyId: string;
  userId: string;
  approvalLimit?: number;
  supplierId?: string;
  landing: string;
  phoneLast4: string;
};

export type SettlementRun = {
  id: string;
  date: string;
  total: number;
  invoiceIds: string[];
  result: 'Success' | 'Failed';
  ranAt: string;
  reconciled: { invoiceId: string; reference: string; matched: boolean }[];
  advices: string[];
  caseId?: string;
};

export type PaymentCase = {
  id: string;
  settlementId: string;
  date: string;
  amount: number;
  graceDays: number;
  lateInterest: number;
  status: 'Open' | 'Closed';
  steps: { day: number; step: string; owner: string; status: 'Done' | 'Due' | 'Pending' }[];
  notes: { at: string; by: string; text: string }[];
};

export type ObligationLump = { entityId: string; dueDate: string; amountUSD: number };

export type PendingConfigChange = {
  by: string;
  at: string;
  changes: { field: string; from: string; to: string }[];
  config: ProgramConfig;
};

export type PendingLimitChange = {
  by: string;
  at: string;
  limits: Record<string, number>;
};

export type ErpSupplier = {
  id: string;
  name: string;
  city: string;
  country: string;
  currency: Currency;
  entityId: string;
  spend12m: number;
  since: number;
};
