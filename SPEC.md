# Corvane Bank Supplier Finance: MVP Build Spec

Build instructions for a clickable prototype of the Supplier Finance module on Corvane Bank's corporate internet banking portal. It is presented live in a 20-minute class presentation (IS445 Corporate Banking Technology) and must match the slide deck "Supplier Finance on Corvane Bank's Corporate Internet Banking Portal".

Read this whole file before writing code. Put it in the repo root as `SPEC.md` and follow it. If something here conflicts with your defaults, this file wins.

---

## 1. What this is

**One web app with three portals that share one set of data.** An action in one portal shows up in the others.

| Portal | Who uses it | Lands on |
|---|---|---|
| Supplier portal | Kaltrex's suppliers (Mercer Precision Parts and others) | Offered invoices |
| Kaltrex workspace | The anchor buyer: CFO, treasurer, AP approvers | Overview (CFO) or Approval queue (approver) |
| Bank staff screen | Corvane Bank: credit officer, onboarding officer, operations, compliance, program admin | Program overview |

**Scenario.** Corvane Bank (fictitious US bank) already runs supplier finance. Kaltrex Industries (fictitious US industrial equipment maker, investment grade, five operating entities) is the anchor. Its suppliers invoice Kaltrex. Kaltrex approves invoices. The bank then pays suppliers early at a price based on Kaltrex's credit rating and debits Kaltrex in full on the due date.

**It is a prototype.** There is no backend, no real authentication and no real money. All data is mock data in the browser. Every button the demo uses must work. Buttons outside the demo path should still do something sensible: open a detail view, show a filled table, or show a short "Not part of the prototype" notice. Never leave a dead click.

**Hard rules from the project (do not break):**
- No blockchain anywhere.
- AI is used in one place only: the supplier rating model. It recommends a rating and a sub-limit, and a credit officer decides. AI never approves invoices, never accepts early payment and never sends money.
- The unusual-invoice check is fixed rules, not AI.
- Invoice approval is always a person at Kaltrex. No bank role and no rule approves an invoice.
- All company and person names are fictitious. Use US examples (SOFR, ACH, Fedwire, OFAC, UCC, FinCEN, ASU 2022-04).

---

## 2. Tech stack

- React 18 + TypeScript + Vite
- Tailwind CSS for styling. Put the design tokens from section 3 in `tailwind.config`.
- React Router with **HashRouter**, so the built file works when opened from disk or any static host.
- Zustand for the shared store, persisted to `localStorage` under one key. Wrap reads and writes in try/catch. The app must also work when storage is blocked.
- Recharts for the few charts.
- lucide-react for icons. Use them sparingly, as described in 3.6.
- `vite-plugin-singlefile`, so `npm run build` produces **one self-contained `dist/index.html`** that can be opened offline or published as a web page. This is a hard requirement: the presenter must be able to open it on any laptop.

No backend, no database, no login provider, no external API calls. Fake the "live FX rate API" from a local table and show it as if it came from an API (section 7.6).

---

## 3. Visual design

### 3.1 Direction

The app should look like a real corporate banking portal (J.P. Morgan Access, CitiDirect, HSBCnet), not a startup dashboard template. Corporate treasury users scan dense tables all day, so aim for:
- a calm, information-dense, table-first layout
- a dark top bar, a white working area and a light grey page background
- the important numbers first, with detail one click away
- clear, separated Approve and Reject actions, with a confirmation step before anything that commits money

Two references:
- Citi describes the CitiDirect redesign as role-tailored landing screens: CFOs and treasurers see decision-level information, operational users see accounts and payments, and screens are organised around user journeys.
- Corporate banking UX guidance stresses three to four key figures plus drill-down (not 18 KPIs), separated approve and reject buttons, risk signals shown before the approver commits, and a confirmation with amount and timing after an action.

### 3.2 Colors (keep the deck's scheme)

```
--ink:        #0B0F1A   main text, top bar background
--grey:       #5B6479   secondary text, labels
--border:     #E3E6EC   table lines, card borders
--page:       #F5F6F8   page background
--panel:      #FFFFFF   cards and tables
--teal:       #00C2B8   brand accent (lines, active nav marker, chart series)
--teal-dark:  #00897F   primary buttons and links (white text passes contrast)
--purple:     #7C4DFF   Kaltrex / approval accent
--purple-dark:#6D28D9
--blue:       #3B82F6   information
--green:      #16A34A   success / paid (slightly darker than the deck's #22C55E for text contrast)
--amber:      #D97706   held / waiting (darker than #F59E0B for text contrast)
--red:        #DC2626   rejected / disputed / failed
```

Use the brand teal for accents, never for large fills. Corvane Bank's logo is a wordmark ("Corvane Bank" in semibold ink with a small teal square before it). Do not draw logos for real companies.

### 3.3 Typography

- Inter (Google Fonts), falling back to system-ui.
- Base size 14px. Table text 13px. Labels 12px uppercase with 0.04em letter spacing in `--grey`.
- Page title 20px semibold. Section title 15px semibold.
- **All money and numbers use tabular figures** (`font-variant-numeric: tabular-nums`) and are right-aligned in tables.
- Money format: `USD 198,333.00` in detail views and `USD 198,333` in tables. The currency code always comes first. Never use `$`.
- Dates: `15 Jan 2027`.

### 3.4 Shapes and spacing

- Corner radius is 4px maximum on buttons, inputs and cards. **No fully rounded or pill shapes anywhere.**
- Borders are 1px `--border`. No drop shadows except a subtle one on modals.
- No gradients, no glassmorphism, no emoji, no illustrations, no large hero sections.
- Use an 8px spacing grid. Table rows are 40px high.

### 3.5 Status display (important)

**Do not use pill or oval badges** (rounded rectangles with tinted backgrounds). The project owner dislikes them; they look AI-generated.

Use the **shape indicator** pattern from IBM's Carbon Design System: a small solid shape plus a plain-text label, with color only on the shape.
- 8×8px square, radius 1px, placed before the label.
- The label is in normal `--ink` text, not colored.
- Color alone never carries meaning. The label is always there.
- Left-align the status column so the squares line up.

```
■ Offered         (square in teal-dark)
■ In approval     (square in purple)
■ Held            (square in amber)
■ Paid early      (square in green)
■ Disputed        (square in red)
```

Invoice status colors:

| Status | Square color |
|---|---|
| Received | grey |
| Validated | blue |
| Held | amber |
| In approval | purple |
| Approved | purple-dark |
| Offered | teal-dark |
| Paid early | green |
| Disputed | red |
| Settled | ink |
| Rejected | red |

A secondary reason sits under the status in 12px `--grey` text, for example "Quantity variance. Awaiting credit note." or "Above your approval limit".

Counts in the left navigation are plain text in `--grey` aligned right ("Approval queue  14"), not bubbles.

### 3.6 Buttons and icons

- Primary button: `--teal-dark` fill, white text, 4px radius, 36px high.
- Secondary button: white fill, 1px `--border`, ink text.
- Destructive button: white fill, red text, 1px red border. It always sits apart from Approve, with at least 24px between them.
- Table row actions are text links in `--teal-dark` ("Approve", "View", "Request payment"), not filled buttons in every row.
- Icons appear only in the left navigation (16px, grey) and in alerts. No decorative icons in cards.

### 3.7 Copy rules (all on-screen text)

The deck's writing rules apply to every label, heading and message:
- Plain, direct English. No idioms or metaphors.
- No "we", "our" or "us" in labels.
- **Never write:** maker/checker, flag/flagged, clears, console, vendor master, benchmark, go-live, one-time code, transaction signing, tenor, rolled up, cross-sell.
- **Write instead:** "held for review", "bank staff screen", "Kaltrex's supplier list in its ERP", "market rate", "launch", "two-factor authentication (2FA)".
- Headings and item titles never contain commas or semicolons. Avoid semicolons in body text too; use short sentences.
- No headings that start with "Where", "When" or "What the".
- No explanatory subtext under page or panel titles. The title and the content speak for themselves. Keep only data context (date, entity, reporting currency, approval limit, quote validity).

---

## 4. Layout shell (all three portals)

```
+--------------------------------------------------------------------------------------------+
| ■ Corvane Bank | Corporate Internet Banking   [Portal name]   Entity ▾  USD ▾   🔔  Name ▾  |  <- 56px, ink background, white text
+----------------+---------------------------------------------------------------------------+
| NAV            |  Page title                                  [secondary btn] [primary btn] |
|                |  Context line in grey: date · entity · currency                           |
| Overview       |  ------------------------------------------------------------------------ |
| Approval queue |                                                                            |
|      14        |   page content (cards, tables, detail panels)                              |
| Obligations    |                                                                            |
| Suppliers      |                                                                            |
| Disputes       |                                                                            |
| Reports        |                                                                            |
| Settings       |                                                                            |
|                |                                                                            |
| ------------   |                                                                            |
| Demo controls  |                                                                            |
+----------------+---------------------------------------------------------------------------+
```

**Top bar**
- Left: the Corvane Bank wordmark, then a thin divider, then "Corporate Internet Banking".
- Middle: the portal name ("Kaltrex Workspace", "Supplier Portal", "Bank Staff Screen").
- Right:
  - an entity switcher (Kaltrex workspace only: five entities plus "All entities")
  - a reporting currency switcher (USD or local)
  - a notifications bell with a plain-number count
  - the user's name and role, with a menu: Profile, Switch user (demo), Sign out

**Left navigation**
- 220px wide, white, with a 1px right border.
- The active item has a 3px teal bar on the left and semibold text.

**Breadcrumbs** appear on detail pages: `Approval queue / OH-48211`.

**Demo controls** sit at the bottom of the left navigation, collapsed by default:
- **Switch user:** jumps between the personas in section 5 without signing out.
- **Reset demo data:** restores the seed data.
- **Advance to due date:** moves the demo clock forward so settlement can be shown.
- **Simulate failed debit:** next settlement debit fails.
- **Simulate duplicate invoice:** pushes a duplicate of OH-48211 through capture so it is held.

These exist only for the presenter. Keep them visually quiet (12px grey links).

---

## 5. Login, roles and permissions

### 5.1 Login screen

```
+------------------------------------------------------------+
|  ■ Corvane Bank                                             |
|                                                             |
|   Sign in to Corporate Internet Banking                     |
|                                                             |
|   Company ID   [ KALTREX        ]                           |
|   User ID      [ dana.ruiz      ]                           |
|   Password     [ ••••••••       ]                           |
|                                [ Continue ]                 |
|                                                             |
|   Demo: choose a user                                       |
|   Kaltrex   Rachel Kim (CFO) · Dana Ruiz (Treasurer) ·      |
|             Mark Feld (AP approver)                         |
|   Supplier  Tom Alvarez (Mercer, finance manager) ...       |
|   Bank      Priya Shah (credit officer) · James Okafor      |
|             (operations) · Ellen Ward (onboarding) ·        |
|             Sam Torres (program admin)                      |
+------------------------------------------------------------+
```

After Continue, show a **2FA step**: "Enter the 6-digit code sent to your registered phone ending 4471", with six input boxes. Any 6 digits are accepted. The step exists to show the security control from the deck's Cybersecurity slide.

### 5.2 Personas

| Persona | Portal | Role | Approval limit | Lands on |
|---|---|---|---|---|
| Rachel Kim | Kaltrex | CFO | USD 5,000,000 | Overview |
| Dana Ruiz | Kaltrex | Treasurer | USD 1,000,000 | Overview |
| Mark Feld | Kaltrex | AP approver | USD 250,000 | Approval queue |
| Tom Alvarez | Supplier (Mercer Precision Parts) | Supplier finance manager | n/a | Offered invoices |
| Lisa Grant | Supplier (Mercer Precision Parts) | AR clerk (view and upload only) | n/a | All invoices |
| Priya Shah | Bank | Credit officer | n/a | Onboarding queue |
| Ellen Ward | Bank | Onboarding officer | n/a | Onboarding queue |
| James Okafor | Bank | Operations | n/a | Review queue |
| Sam Torres | Bank | Program admin (full access, can "View as" Kaltrex or a supplier) | n/a | Program overview |

### 5.3 Permissions

Enforce these in the UI by hiding or disabling actions. A disabled control shows a tooltip giving the reason.

| Action | Who |
|---|---|
| Nominate suppliers | Kaltrex treasurer, CFO |
| Approve invoice | Kaltrex users, within their approval limit |
| Raise dispute | Kaltrex users, supplier finance manager |
| Accept early payment | Supplier finance manager |
| Set standing instruction | Supplier finance manager |
| Change supplier bank account | Supplier finance manager (needs 2FA, then held for verification) |
| Upload invoice PDF | Supplier finance manager, AR clerk, Kaltrex AP |
| Review onboarding checks | Bank onboarding officer |
| Approve supplier and set sub-limit | Bank credit officer (override needs a written reason) |
| Release or reject a held invoice | Bank operations |
| Edit program configuration | Bank program admin (changes need a second bank user to confirm) |
| View audit log | Bank program admin, compliance |

**The bank program admin has a "View as" switch** in the top bar: View as Kaltrex workspace, or as a supplier. While it is on, a thin amber strip below the top bar reads "Viewing as Kaltrex Industries Inc. Read only." This answers the requirement that someone with admin access can click into every part of the platform.

---

## 6. Data model (TypeScript types)

```ts
type Currency = 'USD' | 'EUR' | 'MXN' | 'CNY' | 'SGD';

type Entity = { id: string; name: string; country: string; currency: Currency; subLimit: number /* in entity currency */ };

type Supplier = {
  id: string; name: string; city: string; country: string; currency: Currency;
  kaltrexEntityId: string;
  onboardingStatus: 'Nominated' | 'Registering' | 'Checks running' | 'Checks failed' | 'Awaiting credit decision' | 'Awaiting signature' | 'Enrolled' | 'Declined';
  rating?: 'A' | 'B' | 'C';
  recommendedSubLimit?: number; approvedSubLimit?: number; subLimitUsed: number;
  bankAccount: { bank: string; last4: string; verified: boolean; changedOn?: string };
  checks: { name: string; source: string; result: 'Passed' | 'Failed' | 'Review'; detail: string }[];
  ratingDetail?: RatingCategory[];
  standingInstruction: StandingInstruction;
  avgInvoice12m: number;
};

type RatingCategory = { no: number; name: string; question: string;
  metrics: { name: string; value: string; source: string }[]; score: 'Strong' | 'Adequate' | 'Weak' };

type InvoiceStatus = 'Received' | 'Validated' | 'Held' | 'In approval' | 'Approved' | 'Offered' | 'Paid early' | 'Disputed' | 'Settled' | 'Rejected';

type Invoice = {
  id: string;            // e.g. OH-48211
  supplierId: string; entityId: string; currency: Currency;
  amount: number; invoiceDate: string; dueDate: string;
  poNumber: string; grNumber: string;
  match: 'Matched' | 'Quantity variance' | 'Price variance' | 'No goods receipt';
  source: 'ERP feed' | 'PDF upload';
  status: InvoiceStatus; reason?: string;
  approvedBy?: string; approvedAt?: string;
  quote?: Quote; payment?: Payment;
  history: { at: string; by: string; action: string; detail?: string }[];
};

type Quote = { rate: number; marketRate: number; spread: number; days: number; discount: number; netAmount: number; validUntil: string; fxRate?: number; payoutCurrency?: Currency };
type Payment = { rail: 'ACH' | 'Fedwire' | 'SWIFT' | 'SEPA' | 'FAST'; reference: string; sentAt: string; amount: number; currency: Currency };
type StandingInstruction = { on: boolean; mode: 'All' | 'AboveAmount' | 'MinDays' | 'WeeklyAmount'; value?: number };
type Dispute = { id: string; invoiceId: string; raisedBy: string; reason: string; documents: string[]; paidEarly: boolean; status: 'Open' | 'Resolved'; resolution?: 'Credit note' | 'Corrected invoice' | 'Amount confirmed'; history: {...}[] };
type Alert = { id: string; type: 'Dilution' | 'Volume falling' | 'Limit nearly used' | 'Rating change' | 'Payment not received' | 'Bank account changed'; subject: string; raisedAt: string; owner: 'Credit' | 'Operations'; status: 'Open' | 'Closed' };
type AuditEntry = { at: string; user: string; role: string; action: string; object: string; detail: string };
type ProgramConfig = {
  programLimitUSD: number; spread: number;
  minInvoiceUSD: number; minDaysToDue: number; maxDaysToDue: number;
  currencies: Currency[];
  supplierMinMonths: number; supplierMinVolumeUSD: number; maxDilution: number;
  unusualSizeMultiple: number; roundFigureThreshold: number; nearLimitPct: number; bankChangeDays: number;
};
```

Keep the history arrays: they feed trade tracking and the audit log.

---

## 7. Business logic

### 7.1 Demo clock

Today is fixed at **16 Nov 2026** (stored in the store, so "Advance to due date" can move it). All "days to due date" values come from this date.

### 7.2 Pricing

```
rate      = marketRate(currency) + program spread
discount  = amount × rate × days ÷ 360        (round to whole currency units)
netAmount = amount − discount
```

Market rates (shown as "market rate", never "benchmark"):

| Currency | Rate name | Value |
|---|---|---|
| USD | SOFR | 3.94% |
| EUR | €STR | 1.93% |
| MXN | TIIE | 7.30% |
| CNY | CNH HIBOR | 1.80% |
| SGD | SORA | 1.60% |

Program spread is 1.06%, set by Kaltrex's credit rating and editable in Program configuration.

Check: OH-48211 is USD 200,000 at 5.00% for 60 days, giving a discount of USD 1,667 and a net amount of USD 198,333. These numbers appear in the deck and must match exactly.

### 7.3 Invoice acceptance criteria (rules engine)

Every value comes from `ProgramConfig`, never hard-coded, so the same app works for any program. On every invoice, run these checks and record which passed:

1. Supplier is enrolled.
2. Addressed to a Kaltrex entity in the program.
3. Currency is in the program's list.
4. Days to due date are within the range (default 10 to 180). Not past due.
5. Amount is at or above the minimum (default USD 5,000 equivalent).
6. Not a duplicate. The fingerprint is supplier + invoice number + amount + invoice date.
7. Three-way match: the invoice agrees with the PO and the goods receipt.

A failure sets status to **Rejected** with the reason shown to the supplier and Kaltrex AP. A match variance keeps the invoice "In approval", with the reason "Quantity variance. Awaiting credit note.", and approval is blocked until it is resolved.

### 7.4 Unusual-invoice rules (fixed rules, not AI)

Hold the invoice for bank operations review if any of these apply:
- the amount is more than `unusualSizeMultiple` (default 3×) the supplier's 12-month average invoice
- the amount is an exact multiple of USD 50,000 at or above `roundFigureThreshold` (default USD 250,000)
- the amount is within `nearLimitPct` (default 2%) below any Kaltrex approver's limit
- the supplier's bank account changed within `bankChangeDays` (default 30)

A held invoice has status **Held** and the reason is shown. Operations releases it (to "In approval") or rejects it, entering a reason, which is written to the audit log.

### 7.5 Approval routing

- An approver can approve if the amount in USD is at or below their limit. Otherwise the row shows "Above your approval limit" and the action becomes "Route to approver". That opens a picker of Kaltrex users with enough authority and sends the invoice to their queue.
- Approval flow:
  1. Click Approve. An approval panel opens, showing the invoice beside its PO and goods receipt, with the match result.
  2. The approver confirms the amount, which defaults to the invoice amount less any credit note.
  3. They click "Approve invoice", then pass a 2FA prompt.
  4. The record is written: status becomes Approved and immediately Offered. Program limit used and the supplier's sub-limit used both increase, and an audit entry is added.
  5. A confirmation shows: "Approved. OH-48211, USD 200,000.00, due 15 Jan 2027. Offered to Mercer Precision Parts for early payment."
- Approval is irreversible in the UI. Once approved, there is no Undo, only Raise dispute.

### 7.6 Early payment

- Offered invoices show the quote live: rate, days, discount and net amount.
- The supplier accepts one invoice or several (checkboxes, with a sticky footer showing "Request early payment on 3 selected: USD 412,436").
- On accept:
  1. Run checks before payment. The invoice must still be approved and not disputed, and Kaltrex must still be within its program limit.
  2. Pick the rail. USD under USD 1,000,000 goes by ACH next business day, and USD 1,000,000 or more by Fedwire same day. EUR goes by SEPA. MXN, CNY and SGD go by SWIFT.
  3. Create the payment with reference `CVB-ACH-2026111601` style and set the status to **Paid early**.
- **FX:** if the supplier's payout currency differs from the invoice currency, show "Live market FX rate (via FX rate API)" from a local table, with a "Rate refreshed 09:41:12 ET" timestamp and a small refresh link that nudges the rate by a tiny random amount. The rate is fixed at acceptance.
- **Standing instruction:** when on, the store auto-accepts newly Offered invoices that meet the rule:
  - every approved invoice
  - only above an amount
  - only with at least N days left
  - up to a weekly amount, oldest first

  Show a line in the invoice history: "Accepted automatically by standing instruction".

### 7.7 Settlement

"Advance to due date" moves the clock to the next due date that has Paid-early invoices. The bank's Settlement screen then shows the due-date debit:
- **Debit Kaltrex** for every invoice due that day.
- **On success:** reconcile, mark the invoices Settled, post interest and fees, send advices (shown as a notification in the Kaltrex and supplier portals), and reduce exposure.
- **On failure** (via "Simulate failed debit"):
  - open a "Payment not received" case for operations, with a grace period countdown in days and an escalation path (relationship manager, then credit)
  - raise an alert of type "Payment not received"

### 7.8 Disputes

Kaltrex AP or the supplier raises a dispute, choosing a reason (short delivery, defective parts, price difference or other), entering text and attaching a mock file name. What happens next depends on whether the bank has already paid early:

**Not yet paid early:** the status becomes Disputed and the invoice is removed from the supplier's offered list until the dispute is resolved.

**Already paid early:** the invoice keeps its Paid early status, and the dispute record shows:

> "The bank has already paid this invoice early. Kaltrex still pays Corvane Bank in full on the due date and remains liable for the invoice. Kaltrex recovers the amount from the supplier, usually as a credit note on the next invoice."

**Resolution:** both parties see one case screen with a message thread. It closes in one of three ways:
- **Credit note:** a credit note is created against the supplier's next invoice.
- **Corrected invoice:** the corrected invoice re-enters capture.
- **Amount confirmed:** the invoice returns to Offered if it had not been paid.

### 7.9 Early warnings (monitoring rules)

These rules run on the store data and create Alerts:
- dilution above the program limit
- supplier volume falling
- a sub-limit or the program limit nearly used (default 85%, configurable)
- a Kaltrex credit rating change (triggered by a demo button in bank Settings)
- a payment not received on a due date
- a supplier bank account changed

Each alert opens a case for credit or operations. **No alert changes a limit by itself.**

### 7.10 Audit log

Every state change appends an AuditEntry recording the user, role, time, action, object and detail. The log is append-only: the UI has no edit or delete.

---

## 8. Seed data

### 8.1 Program
- Program limit USD 50,000,000. Used USD 31,000,000 (62%).
- Spread 1.06%. Acceptance criteria values as the defaults above.
- Set Mercer's 12-month average invoice to USD 150,000, so none of the Mercer demo invoices trip the unusual-invoice rules. Check this with a unit test: OH-48211 and OH-48240 must not be held.

### 8.2 Kaltrex entities

| Entity | Country | Currency | Sub-limit |
|---|---|---|---|
| Kaltrex Industries Inc. | US | USD | USD 30,000,000 |
| Kaltrex GmbH | Germany | EUR | EUR 8,000,000 |
| Kaltrex de México | Mexico | MXN | MXN 60,000,000 |
| Kaltrex (Shanghai) | China | CNY | CNY 20,000,000 |
| Kaltrex Asia Pacific | Singapore | SGD | SGD 2,000,000 |

Obligations by currency for the overview chart (USD millions): USD 19.3, EUR 6.8, MXN 2.4, CNY 1.7, SGD 0.8.

Obligations by maturity (USD millions): 15 Nov 6.2, 30 Nov 8.1, 15 Dec 4.1, 31 Dec 7.6, 15 Jan 5.0.

### 8.3 Suppliers

| Supplier | City | Currency | Entity | Status | Rating | Sub-limit |
|---|---|---|---|---|---|---|
| Mercer Precision Parts | Dayton, Ohio | USD | Kaltrex Industries Inc. | Enrolled | A | USD 1,500,000 |
| Hauser Antriebstechnik GmbH | Stuttgart | EUR | Kaltrex GmbH | Enrolled | A | EUR 900,000 |
| Fundiciones del Norte | Monterrey | MXN | Kaltrex de México | Enrolled | B | MXN 12,000,000 |
| Lianfa Castings Co. | Suzhou | CNY | Kaltrex (Shanghai) | Enrolled | B | CNY 4,000,000 |
| Straits Polymer Pte. Ltd. | Singapore | SGD | Kaltrex Asia Pacific | Enrolled | A | SGD 600,000 |
| Brennan Fastener Supply | Toledo, Ohio | USD | Kaltrex Industries Inc. | Awaiting credit decision | B (recommended) | USD 400,000 (recommended) |
| Ridgeway Coatings LLC | Erie, Pennsylvania | USD | Kaltrex Industries Inc. | Checks running | n/a | n/a |
| Atlas Freight Components | Houston, Texas | USD | Kaltrex Industries Inc. | Checks failed (UCC lien found) | n/a | n/a |

Brennan Fastener Supply is the onboarding demo case. Give it full check results and a full rating breakdown (section 9.3.3).

### 8.4 Invoices (keep these exactly, the deck shows them)

| Invoice | Supplier | Amount | Due | Days | Match | Status | Notes |
|---|---|---|---|---|---|---|---|
| OH-48211 | Mercer | USD 200,000 | 15 Jan 2027 | 60 | Matched | In approval | Demo invoice. Approved live, then quoted at discount USD 1,667, net USD 198,333 |
| OH-48190 | Mercer | USD 48,200 | 30 Dec 2026 | 44 | Matched | Offered | Discount USD 295, net USD 47,905 |
| OH-48225 | Mercer | USD 167,900 | 28 Jan 2027 | 73 | Matched | Offered | Discount USD 1,702, net USD 166,198 |
| OH-48230 | Mercer | USD 22,400 | 12 Feb 2027 | 88 | Matched | In approval | |
| OH-48198 | Mercer | USD 9,850 | 20 Dec 2026 | 34 | Matched | Disputed | Short delivery, not yet paid early |
| OH-48102 | Mercer | USD 61,300 | 1 Dec 2026 | 15 | Matched | Paid early | Paid by ACH on 2 Oct |
| OH-47950 | Mercer | USD 54,000 | 1 Nov 2026 | past | Matched | Settled | |
| DE-10377 | Hauser | EUR 150,000 | 20 Jan 2027 | 65 | Matched | In approval | |
| DE-10341 | Hauser | EUR 82,500 | 18 Dec 2026 | 32 | Matched | Paid early | Defect found after payment. Dispute open, paid-early branch |
| MX-22904 | Fundiciones | MXN 3,100,000 | 9 Jan 2027 | 54 | Quantity variance | In approval | "Quantity variance. Awaiting credit note." |
| CN-55120 | Lianfa | CNY 1,250,000 | 3 Feb 2027 | 79 | Matched | Held | Bank account changed 9 days ago |
| SG-30418 | Straits Polymer | SGD 96,000 | 22 Jan 2027 | 67 | Matched | Offered | |
| OH-48240 | Mercer | USD 410,000 | 5 Feb 2027 | 81 | Matched | In approval | Above Mark Feld's limit. Routes to Dana Ruiz |

Add about 25 more invoices across all suppliers and statuses so tables look real: some Settled, some Rejected with reasons ("Due date beyond 180 days", "Duplicate of OH-47712", "Below program minimum").

### 8.5 Mercer's demo standing instruction

Off at the start, so it can be turned on live.

---

## 9. Screens

Each screen below lists its purpose, contents and actions. The wireframes are ASCII and show structure only. Apply section 3 for the look.

### 9.1 Supplier portal (Mercer Precision Parts)

Nav: **Offered invoices · All invoices · Payments · Standing instruction · Disputes · Company profile · Onboarding** (Onboarding appears only for a supplier that is not yet enrolled).

#### 9.1.1 Offered invoices (home)

```
(State shown: after OH-48211 is approved in step 2 of the demo. Before that, two invoices are offered.)

Offered invoices                                       Quotes valid today until 16:00 ET
Approved by Kaltrex and ready for early payment
+----------------------+ +-----------------------------+ +---------------------------+
| AVAILABLE TODAY      | | YOUR RATE TODAY             | | STANDING INSTRUCTION      |
| USD 412,436          | | 5.00% a year                | | Off                       |
| 3 invoices, net      | | SOFR 3.94% + 1.06% spread   | | Turn on >                 |
+----------------------+ +-----------------------------+ +---------------------------+

[ ] Invoice   Kaltrex entity        Due          Days  Amount        Discount   You receive   Status        Action
[x] OH-48211  Kaltrex Industries    15 Jan 2027    60  USD 200,000   USD 1,667  USD 198,333   ■ Offered     Request payment
[x] OH-48190  Kaltrex Industries    30 Dec 2026    44  USD  48,200   USD   295  USD  47,905   ■ Offered     Request payment
[x] OH-48225  Kaltrex Industries    28 Jan 2027    73  USD 167,900   USD 1,702  USD 166,198   ■ Offered     Request payment
                                                                                   ----------------------------------
                                            Request early payment on 3 selected:  USD 412,436   [ Request payment ]
```

Clicking "Request payment" opens a confirmation panel showing:
- the invoices, total face value, total discount and total received
- the payout bank account (bank name and last four digits)
- the rail and expected arrival ("ACH. Arrives 17 Nov 2026")
- the buttons "Confirm request" and "Cancel"

After confirming, show the outcome with amount, timing and reference ("Payment sent. USD 412,436.00 by ACH. Arrives 17 Nov 2026. Reference CVB-ACH-2026111601.") and a "Download advice" link that opens a printable advice page.

#### 9.1.2 All invoices
- A filter row: status (multi-select), date range and search by invoice number.
- Columns: invoice, PO, due, amount, status (with reason line), last update.
- Clicking a row opens **Invoice detail** (shared component, section 9.4).
- An "Upload invoice" button opens an upload panel: drop a PDF (any file). It shows a fake OCR result with fields pre-filled (invoice number, PO, amount, dates) that the user can edit, then "Submit". The new invoice runs the acceptance criteria and appears as Received, then Validated, then In approval or Rejected, each step about 600ms apart, so the checks are visible.

#### 9.1.3 Payments
A table of early payments with columns: date, reference, rail, invoices, face value, discount, received and an advice link.

#### 9.1.4 Standing instruction

```
Standing instruction
A rule you set once. The platform then accepts early payment for you automatically.

( ) Off
(•) Every approved invoice
( ) Only invoices above an amount        [ USD ______ ]
( ) Only invoices with at least           [ __ ] days left to the due date
( ) Up to an amount each week             [ USD ______ ]   oldest first

[ Save ]   (saving asks for 2FA)
```

Turning it on, with OH-48211 still in approval, means approving OH-48211 in the Kaltrex workspace pays Mercer immediately. This is an alternate demo path.

#### 9.1.5 Disputes
A list of disputes, with "Raise dispute" on an invoice. The dispute case screen is shared with Kaltrex (section 9.4.2).

#### 9.1.6 Company profile
- Company details and authorized signers.
- **Bank account** with a "Change bank account" action. The change needs 2FA, then shows "New account held for verification. Invoices paid to this account are held for review for 30 days." It also creates an alert of type "Bank account changed".
- Users.

#### 9.1.7 Onboarding (for a nominated supplier, used with Ridgeway Coatings)
A four-step registration wizard with a step bar at the top (plain numbered text, not circles):
1. **Company details:** legal name, EIN, address, state of incorporation.
2. **Owners and signers:** beneficial owners above 25% and authorized signers.
3. **Bank account.**
4. **Documents:** upload incorporation papers and signer IDs, which shows "Read by OCR" fields.

Then "Submit". A status page shows the automatic checks running one by one:
- e-KYC registry
- beneficial owners
- OFAC sanctions
- UCC lien search
- bank account verification

Each check shows a result and its source.

### 9.2 Kaltrex workspace

Nav: **Overview · Approval queue · Obligations · Suppliers · Disputes · Reports · Program settings**

#### 9.2.1 Overview (CFO and treasurer home)

```
Overview                         16 Nov 2026 · All entities · Reporting in USD
+---------------------+ +---------------------+ +---------------------+ +---------------------+
| PROGRAM LIMIT USED  | | DUE IN NEXT 30 DAYS | | DPO ON PROGRAM      | | AWAITING APPROVAL   |
| 62%                 | | USD 18.4M           | | INVOICES  90 days   | | 14                  |
| USD 31.0M of 50.0M  | | 3 maturity dates    | | was 60 before       | | USD 2.9M · oldest   |
| ▇▇▇▇▇▇▇▇▇▇░░░░░░    | |                     | | enrollment          | | 2 days  Open queue >|
+---------------------+ +---------------------+ +---------------------+ +---------------------+
+-------------------------------------------+ +----------------------------------------------+
| Obligations by maturity date (USD M)      | | Obligations by currency and entity           |
|  bar chart 15 Nov ... 15 Jan              | |  USD Kaltrex Industries Inc.  ███████ 19.3M  |
|                                           | |  EUR Kaltrex GmbH             ███     6.8M   |
|                                           | |  ...                                         |
+-------------------------------------------+ +----------------------------------------------+
Approval queue · showing 5 of 14                                                  View all >
(compact version of 9.2.2)
```

- The tiles are clickable. "Program limit used" goes to Obligations, and "Awaiting approval" goes to the Approval queue.
- Changing the top-bar entity filters everything on the page.
- The currency toggle switches between USD totals and local currency.

#### 9.2.2 Approval queue

```
Approval queue                                     Your approval limit: USD 250,000
Filter: Entity ▾  Supplier ▾  Match ▾                                      Search [    ]

Invoice   Supplier                 Entity       Amount           Due          Match              Status                      Action
OH-48211  Mercer Precision Parts   Industries   USD 200,000      15 Jan 2027  ✓ Matched          ■ In approval               Approve
DE-10377  Hauser Antriebstechnik   GmbH         EUR 150,000      20 Jan 2027  ✓ Matched          ■ In approval               Approve
MX-22904  Fundiciones del Norte    de México    MXN 3,100,000    9 Jan 2027   Quantity variance  ■ In approval               View
                                                                                                   Awaiting credit note
OH-48240  Mercer Precision Parts   Industries   USD 410,000      5 Feb 2027   ✓ Matched          ■ In approval               Route to approver
                                                                                                   Above your approval limit
```

- The Match column is plain text. The check mark for Matched is in green, and variances are in amber text.
- Selecting several rows allows bulk approval within your limit. It still asks for one 2FA.

#### 9.2.3 Approval panel (opens from Approve)

```
Approve invoice OH-48211                                                            [ x ]
+--------------------------+ +--------------------------+ +--------------------------+
| INVOICE                  | | PURCHASE ORDER PO-77120  | | GOODS RECEIPT GR-55031   |
| Mercer Precision Parts   | | 400 × spindle housing    | | 400 received 2 Nov 2026  |
| 400 × spindle housing    | | USD 500.00 each          | | Inspected. No rejects    |
| USD 200,000.00           | | USD 200,000.00           | |                          |
+--------------------------+ +--------------------------+ +--------------------------+
Three-way match: Matched
Credit notes against this invoice: None

Amount to approve   [ USD 200,000.00 ]
Due date            15 Jan 2027

Approving commits Kaltrex Industries Inc. to pay Corvane Bank this amount on the due date.

[ Reject ]                                                     [ Cancel ]  [ Approve invoice ]
```

- "Reject" sits on the left, far from "Approve invoice", and asks for a reason.
- "Approve invoice" opens the 2FA prompt, then the confirmation (section 7.5).

#### 9.2.4 Obligations
- A maturity calendar: a table grouped by due date showing the total due, the number of invoices and entities. Expanding a row lists its invoices.
- "Export" downloads a CSV generated in the browser.

#### 9.2.5 Suppliers
- A list of nominated and enrolled suppliers with columns: onboarding status, rating, sub-limit, used, and invoices in the last 12 months.
- "Nominate suppliers" pulls a list from "Kaltrex's supplier list in its ERP" (mock) with checkboxes, then "Nominate". The new suppliers appear as Nominated in the bank's onboarding queue.

#### 9.2.6 Disputes
The same component as the supplier side, from Kaltrex's view.

#### 9.2.7 Reports
Three cards, each opening a printable report page:
- **ASU 2022-04 obligations rollforward:** opening balance, invoices confirmed, amounts paid, closing balance by quarter, plus the key program terms.
- **Supplier list.**
- **Audit extract** for Kaltrex's own actions.

#### 9.2.8 Program settings
- **Approval limits per role:** an editable table. Saving asks for 2FA and a second Kaltrex user to confirm (simulated).
- **Users and roles.**
- **Entities** (read only).

### 9.3 Bank staff screen

Nav: **Program overview · Onboarding queue · Review queue · Payments · Settlement · Early warnings · Disputes · Audit log · Program configuration**

#### 9.3.1 Program overview (program admin home)
- **Tiles:**
  - exposure to Kaltrex against the program limit
  - invoices paid early this month (count and value)
  - discount income this month
  - open items: held invoices, onboarding cases, failed debits and open alerts, each linking to its queue
- **Charts:** exposure by maturity, and early-payment volume by week over the last 12 weeks.
- The "View as" switch is in the top bar (section 5.3).

#### 9.3.2 Onboarding queue

```
Onboarding queue
Supplier                   Nominated by  Entity               Stage                        Owner         Opened
Brennan Fastener Supply    Kaltrex       Industries Inc.      ■ Awaiting credit decision   Priya Shah    12 Nov
Ridgeway Coatings LLC      Kaltrex       Industries Inc.      ■ Checks running             Ellen Ward    14 Nov
Atlas Freight Components   Kaltrex       Industries Inc.      ■ Checks failed              Ellen Ward    10 Nov
                                                                 UCC lien found
```

#### 9.3.3 Supplier case (the credit decision screen; key demo screen)

```
Brennan Fastener Supply                                          Stage: Awaiting credit decision
Toledo, Ohio · Nominated by Kaltrex 12 Nov 2026 · Supplier to Kaltrex Industries Inc. since 2017

[ Checks ] [ Relationship assessment ] [ Documents ] [ History ]

CHECKS                                    Source                       Result
Company confirmed in state registry       e-KYC registry API           ■ Passed
Beneficial owners identified (2)          e-KYC, FinCEN CDD rule       ■ Passed
Sanctions screening                       OFAC API                     ■ Passed
Not a related party                       KYC ownership data           ■ Passed
No competing lien                         UCC search API               ■ Passed
Bank account ownership                    Account verification         ■ Passed

RELATIONSHIP ASSESSMENT        (24 months of Kaltrex payables data via ERP API)
1 Relationship history     Strong     Tenure 9 years · USD 2.1M a year · 14 invoices a month · stable
2 Mutual importance        Adequate   Kaltrex is 31% of supplier revenue · not sole source
3 Performance quality      Strong     Dilution 1.2% · disputes 0.8% · on-time delivery 97%
4 Anchor payment behavior  Strong     Kaltrex pays on terms · approval lag 6 days
5 Contract strength        Adequate   Supply contract 18 months left · terms fixed in contract
6 Integrity                Strong     Match rate 98% · no duplicates · no recent bank change
7 The supplier on its own  Passed     KYC, sanctions, UCC and financial health all passed
(each row expands to show its metrics, values and data sources)

+---------------------------------------------------------------------------------------+
| RATING MODEL RECOMMENDATION                                                           |
| Rating B · Recommended sub-limit USD 400,000                                          |
| The rating model recommends. The credit officer decides.                              |
+---------------------------------------------------------------------------------------+

Credit decision
Rating      [ B ▾ ]
Sub-limit   [ USD 400,000 ]
Reason      [ required if rating or sub-limit differs from the recommendation        ]

[ Decline ]                                      [ Approve and send agreement for e-signature ]
```

- If the officer changes the rating or sub-limit, the Reason field becomes required and the change is logged as an override.
- Approving moves the case to "Awaiting signature". A "Simulate supplier signature" demo link then moves it to Enrolled.

#### 9.3.4 Review queue (operations)
- Held invoices, with columns: invoice, supplier, amount, rule that held it, held since.
- A row opens a review panel with the invoice, its match record, the rule and the supplier's recent invoices for comparison. The actions are **Release to approval** and **Reject**, both requiring a reason. "Release" and "Reject" sit far apart.
- The "Simulate duplicate invoice" demo control adds a duplicate of OH-48211 here, held with the reason "Duplicate of OH-48211 (same supplier, number, amount and date)".

#### 9.3.5 Payments
- Early payments sent, with columns: reference, supplier, rail, currency, amount, sent, status (Sent or Returned).
- Filter by rail and currency.

#### 9.3.6 Settlement
- Upcoming due-date debits by date, with the total per date.
- A row expands to the invoices.
- After "Advance to due date": shows the debit result, reconciliation (matched by invoice reference) and the advices sent.
- A failed debit shows the "Payment not received" case, with grace period, late interest and escalation steps, and owners.

#### 9.3.7 Early warnings
- A table of alerts with columns: type, subject, raised, owner, status.
- Each opens a case with notes and a Close action.
- A banner states: "Alerts open a case. They do not change any limit."

#### 9.3.8 Disputes
All disputes across the program, read only, with links to the case.

#### 9.3.9 Audit log
- Append-only table with columns: time, user, role, action, object, detail.
- Filter by user, action and date.
- An Export link.

#### 9.3.10 Program configuration
- Editable `ProgramConfig` fields grouped under four headings:
  - program limit and pricing
  - invoice acceptance criteria
  - supplier acceptance criteria
  - unusual-invoice rules
- Saving shows "Change waiting for a second bank user to confirm" and a "Confirm as second user (demo)" link.
- A "Simulate Kaltrex rating change" link creates a Rating change alert.

### 9.4 Shared components

#### 9.4.1 Invoice detail (used by all three portals, scoped by role)

```
OH-48211 · Mercer Precision Parts → Kaltrex Industries Inc.            ■ Paid early
USD 200,000.00 · Due 15 Jan 2027 · PO-77120 · GR-55031 · Source: ERP feed

[ Summary ] [ Checks ] [ History ] [ Documents ]

ACCEPTANCE CRITERIA                      Result
Supplier enrolled                        Passed
Kaltrex entity in program                Passed
Currency accepted                        Passed
Due date within range (10 to 180 days)   Passed (60 days)
Amount at or above minimum               Passed
Not a duplicate                          Passed
Three-way match                          Matched
Unusual-invoice rules                    None applied

HISTORY (trade tracking)
16 Nov 09:02  ERP feed          Received
16 Nov 09:02  Rules engine      Validated
16 Nov 09:40  Mark Feld         Approved. USD 200,000.00. 2FA confirmed
16 Nov 09:40  System            Offered. Rate 5.00%. Net USD 198,333
16 Nov 09:44  Tom Alvarez       Early payment accepted
16 Nov 09:44  Payment hub       Paid early. ACH. CVB-ACH-2026111601
```

- Suppliers do not see other suppliers' data or Kaltrex's internal approval limits.
- The bank sees everything.

#### 9.4.2 Dispute case
- Header: invoice, amount, parties, status.
- If the invoice was paid early, show the liability note from 7.8 in a bordered box.
- A message thread with an attachment list.
- Resolution actions for the party raising the dispute and for Kaltrex: credit note, corrected invoice, amount confirmed.

#### 9.4.3 2FA prompt
- A modal with six code boxes and the text "Enter the code sent to your registered phone ending 4471".
- Any six digits are accepted.
- It is used for login, invoice approval, bank account change, standing instruction save, and configuration changes.

#### 9.4.4 Notifications
- The bell lists events relevant to the portal, for example "OH-48211 approved by Kaltrex and offered to you" or "Payment sent".
- Clicking one opens the object.

#### 9.4.5 Empty, loading and error states
- **Empty tables:** say what will appear there ("No held invoices. Invoices held by the unusual-invoice rules appear here.").
- **Loading:** a 300 to 600ms skeleton for the "API" steps (KYC checks, OCR, FX rate), so the presenter can narrate what is happening.

---

## 10. Golden demo path (must work perfectly, start to finish)

This matches the prototype walkthrough on the deck's Kaltrex workspace slide. It takes about five minutes.

1. **Sign in as Mark Feld (Kaltrex AP approver)**, including the 2FA step. Land on the Approval queue.
2. **Open OH-48211.** Show the invoice, PO and goods receipt side by side and the Matched result. Approve it with 2FA. The confirmation appears.
3. Show **OH-48240 "Above your approval limit"** and route it to Dana Ruiz.
4. **Switch user to Tom Alvarez (Mercer).** The notification "OH-48211 approved and offered" appears. Offered invoices now shows OH-48211 with discount USD 1,667 and net USD 198,333.
5. **Select OH-48211 and request payment.** The confirmation shows ACH, arrival 17 Nov and the reference. The status becomes Paid early.
6. **Switch user to Rachel Kim (Kaltrex CFO).** On the Overview the new obligation appears: the due-in-30-days or maturity chart has been updated, and program limit used has increased.
7. **Switch user to James Okafor (bank operations).** Use "Simulate duplicate invoice". The duplicate of OH-48211 appears in the Review queue, held with its reason. Reject it with a reason.
8. **Switch user to Sam Torres (program admin).** Open the Audit log and show every step above with user and time.

Optional extras if time allows:
- Priya Shah approves Brennan Fastener Supply with an override reason.
- "Advance to due date" and settlement.
- The dispute on DE-10341 (paid-early branch).
- Turn on a standing instruction.

---

## 11. Build order for Claude Code

Do these in order and run the app after each phase.

1. **Project setup:**
   - Vite + React + TS + Tailwind + Router (hash) + Zustand + Recharts + lucide + vite-plugin-singlefile
   - design tokens
   - Inter font
2. **Shell:** top bar, left nav, page header, the status shape-indicator component, money and date formatters, buttons, tables with sortable headers, modal and side panel, 2FA modal, toast confirmation.
3. **Store and seed data** (section 8), plus the logic in section 7 as pure functions with unit tests for pricing, acceptance criteria, unusual-invoice rules and approval routing. Check that the OH-48211 numbers match exactly.
4. **Login and personas,** switch user, "View as" and the demo controls.
5. **Kaltrex workspace** screens.
6. **Supplier portal** screens.
7. **Bank staff screen** screens.
8. **Shared invoice detail, dispute case and notifications.**
9. **Golden demo path** run-through. Fix anything that breaks.
10. **Polish pass** against the checklist in section 12. Then `npm run build` and confirm `dist/index.html` opens directly from disk with no server.

---

## 12. Acceptance checklist

**Demo and navigation**
- [ ] The golden demo path (section 10) works start to finish without a page reload.
- [ ] Every nav item in every portal opens a populated screen.
- [ ] No clickable element does nothing.
- [ ] The program admin can "View as" Kaltrex and a supplier.
- [ ] Switching users keeps the shared state. Reset demo data restores the seed.

**Calculations and logic**
- [ ] OH-48211 shows discount USD 1,667 and net USD 198,333.
- [ ] Changing the spread in Program configuration changes quotes everywhere.
- [ ] All criteria values come from Program configuration. None is hard-coded in components.

**Design rules**
- [ ] No pill or oval shapes anywhere. Statuses use the square shape plus plain text.
- [ ] No radius above 4px. No gradients, emoji or decorative icons.
- [ ] Money is right-aligned in tables, uses tabular figures and puts the currency code first.

**Copy and safeguards**
- [ ] Every on-screen word follows section 3.7.
- [ ] Approve and Reject are separated, and approval asks for 2FA and shows a confirmation with amount and timing.
- [ ] Nothing AI-driven approves, accepts or pays. The rating model only recommends.

**Build**
- [ ] `npm run build` produces one `index.html` that works offline.

---

## 13. Out of scope

- Real authentication, real APIs, real payment rails, a backend or a database.
- Mobile layouts. Design for a 1440×900 laptop screen used in presentation mode, with a usable layout down to 1280px wide.
- Multiple anchors beyond Kaltrex. Program configuration can mention that a new anchor is added by configuration, but there is no second anchor in the data.
