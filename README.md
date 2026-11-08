# Corvane Bank Supplier Finance prototype

Clickable prototype of the Supplier Finance module on Corvane Bank's corporate internet banking portal. Three portals (Kaltrex workspace, supplier portal, bank staff screen) share one in-browser store. No backend, no real money. The full build spec is in `SPEC.md`.

## Run

```bash
npm install
npm run dev
```

Open the printed localhost address. Sign in as any demo user. Any six digits pass the 2FA step.

## Live demo

https://oli181305.github.io/corvane-supplier-finance-prototype/

Published from the `gh-pages` branch. To republish after a change:

```bash
npm run deploy
```

This rebuilds `dist/index.html` and pushes it to `gh-pages`. GitHub Pages updates the same URL within about a minute.

## Build the single file for the presentation

```bash
npm run build
```

`dist/index.html` is one self-contained file. Copy it to any laptop and open it from disk. No server is needed. The Inter font loads from Google Fonts when online and falls back to the system font offline.

## Tests

```bash
npm test
```

Covers pricing (OH-48211: USD 200,000 at 5.00% for 60 days gives discount USD 1,667 and net USD 198,333), the acceptance criteria, the unusual-invoice rules, approval routing and payment rails.

## Golden demo path (about five minutes)

1. Sign in as Mark Feld (Kaltrex AP approver). Land on the Approval queue.
2. Open OH-48211. Approve it with 2FA. The confirmation shows amount, due date and the offer to Mercer.
3. Open OH-48240 (above Mark's limit). Route it to Dana Ruiz.
4. Switch user to Tom Alvarez (Mercer). The bell shows the offer. Offered invoices lists OH-48211 at discount USD 1,667 and net USD 198,333.
5. Request payment on OH-48211. Confirm. Payment sent by ACH, arrives 17 Nov 2026, reference CVB-ACH-2026111601.
6. Switch user to Rachel Kim (CFO). Program limit used rose to USD 31.2M and the 15 Jan maturity bar grew.
7. Switch user to James Okafor (bank operations). Demo controls, Simulate duplicate invoice. Open it in the Review queue and reject it with a reason.
8. Switch user to Sam Torres (program admin). Open the Audit log.

Optional extras: Priya Shah approves Brennan Fastener Supply with an override reason, Advance to due date runs a settlement (Simulate failed debit first to see the case), the dispute on DE-10341 shows the paid-early liability note, and Tom can turn on a standing instruction.

## Demo controls

At the bottom of the left navigation: switch user, reset demo data, advance to due date, simulate failed debit, simulate duplicate invoice. The demo date is fixed at 16 Nov 2026. State persists in the browser under one localStorage key. Reset demo data restores the seed.
