import { useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, BookOpen } from "lucide-react";
import mermaid from "mermaid";

const diagrams: { id: string; title: string; code: string }[] = [
  {
    id: "p2p",
    title: "Procure-to-Pay (P2P) Cycle",
    code: `flowchart LR
  A[Requisition<br/>Draft] --> B{Approved?}
  B -->|Yes| C[RFQ / Invite 3 Vendors]
  C --> D[Vendor Quotes]
  D --> E[Award & Convert to PO]
  E --> F[PO Sent to Vendor]
  F --> G[Goods Receipt Note<br/>GRN]
  G --> H[Vendor Invoice<br/>Portal or Manual]
  H --> I{3-Way Match<br/>PO=GRN=Invoice}
  I -->|Match| J[Post to GL]
  I -->|Exception| K[Match Exceptions Hold]
  J --> L[AP Payment]
  L --> M[Bank Reconciliation]`,
  },
  {
    id: "o2c",
    title: "Order-to-Cash (O2C) Cycle",
    code: `flowchart LR
  Q[Sales Quotation] --> SO[Sales Order<br/>Reserves Stock]
  SO --> DN[Delivery Note<br/>Decrements Inventory + COGS]
  DN --> AR[AR Invoice<br/>with VAT]
  AR --> RC[AR Receipt<br/>Full or Partial]
  RC --> BR[Bank Reconciliation]
  AR -.credit.-> CN[AR Credit Note]`,
  },
  {
    id: "inv",
    title: "Inventory & Warehouse",
    code: `flowchart TD
  GRN[GRN Posted] --> BAL[Inventory Balance +<br/>FIFO Layer created]
  BAL --> ISS[Issue to Dept/Project]
  ISS --> COGS[DR Expense / CR Inventory<br/>FIFO consumed]
  ISS --> RET[Issue Return<br/>Restores stock + reverses GL]
  BAL --> TRF[Transfer<br/>Source - / Dest +]
  BAL --> ADJ[Adjustment]
  BAL --> VAL[Valuation Report<br/>= Balance Sheet Inventory]`,
  },
  {
    id: "gl",
    title: "General Ledger & Close",
    code: `flowchart LR
  TXN[Sub-ledger Postings<br/>AP / AR / Inv / Payroll / Assets] --> JE[Journal Entries]
  JE --> POST{Balanced?}
  POST -->|Yes| GL[Posted to GL]
  POST -->|No| DRAFT[Save as Draft]
  GL --> TB[Trial Balance]
  TB --> RPT[P&L / Balance Sheet / Cash Flow]
  GL --> LOCK[Fiscal Period Lock]
  LOCK --> YEC[Year-End Close<br/>Revenue+Expense -> Retained Earnings]`,
  },
  {
    id: "cash",
    title: "Cash & Bank",
    code: `flowchart LR
  BA[Bank Accounts<br/>Checking / Savings / Petty Cash] --> APP[AP Payment]
  BA --> ARR[AR Receipt]
  BA --> FT[Fund Transfer]
  BA --> PC[Petty Cash Expense]
  APP & ARR & FT & PC --> BT[Bank Transactions]
  BT --> BR[Bank Reconciliation<br/>Manual / AI / CSV]
  BT --> STMT[Bank Statement PDF/Excel]`,
  },
  {
    id: "assets",
    title: "Fixed Assets Lifecycle",
    code: `flowchart LR
  ACQ[Acquire Asset<br/>Category + Dept] --> REG[Asset Register]
  REG --> DEP[Monthly Depreciation<br/>Auto GL Posting]
  DEP --> NBV[Net Book Value]
  NBV --> DISP[Disposal<br/>Gain/Loss JE]`,
  },
  {
    id: "roles",
    title: "Roles & Separation of Duties",
    code: `flowchart TB
  REQ[Requester] -->|creates| PR[Requisition]
  MGR[Manager] -->|approves| PR
  BUY[Buyer / Procurement] -->|awards & PO| PO[Purchase Order]
  WH[Warehouse] -->|receives| GRN[GRN]
  AP[AP Clerk] -->|logs invoice| INV[AP Invoice]
  FIN[Finance Manager] -->|approves & pays| PAY[Payment]
  ADM[Admin] -->|users, roles, periods, backups| SYS[System]
  CHM[Chairman] -->|read-only oversight| DASH[Dashboards]`,
  },
];

const sections = [
  {
    h: "1. What this system is",
    body: `A multi-tenant ERP covering Procurement, Warehouse/Inventory, Sales, Finance (GL/AP/AR/Cash/Assets), Projects, Budgets, HR/Payroll, plus Staff and Vendor self-service portals. Every organization's data is isolated by Row-Level Security using organization_id. Default currency is Nigerian Naira (₦).`,
  },
  {
    h: "2. Golden rules (memorize these)",
    body: `• Transactions can only be edited or deleted while in DRAFT status.
• Every posting produces a balanced double-entry Journal Entry (debits = credits) — the trigger rejects unbalanced entries.
• Inventory balance can never go negative — the trigger blocks it.
• Master data (items, vendors, accounts, locations) with historical transactions cannot be deleted, only deactivated.
• Fiscal periods can be locked; postings to a locked period are rejected.
• Blacklisting a vendor requires a reason AND manager approval.
• Sequential document numbers (PR-, PO-, GRN-, INV-, etc.) are generated server-side — never manually typed.`,
  },
  {
    h: "3. The four core cycles",
    body: `P2P (Procure-to-Pay): Requisition → RFQ (invite 3 vendors) → Award → PO → GRN → Vendor Invoice → 3-Way Match → AP Payment.
O2C (Order-to-Cash): Quotation → Sales Order (reserves stock) → Delivery Note (drops stock + COGS) → AR Invoice (with VAT) → AR Receipt.
Inventory: GRN in, Issue out (to dept/project, FIFO), Transfer between locations, Return, Adjustment. Valuation always reconciles to Balance Sheet Inventory account.
Record-to-Report: Sub-ledgers post to GL → Trial Balance → P&L / Balance Sheet / Cash Flow → Fiscal Period Lock → Year-End Close.`,
  },
  {
    h: "4. Three-way match",
    body: `An AP Invoice only clears when PO quantity = GRN quantity = Invoice quantity (within tolerance). Mismatches are held in Match Exceptions. The invoice review dialog shows ticks for each leg: PO ✓ GRN ✓ Invoice ✓.`,
  },
  {
    h: "5. VAT & tax",
    body: `Tax Configuration defines active tax rates. AR Invoices, AP Invoices, and Log Vendor Invoice all compute VAT from the active rate and persist tax_amount. Tax posts to its own GL account per the tax group configuration.`,
  },
  {
    h: "6. Approvals & workflows",
    body: `Approval Rules define who approves what and at what threshold. Rejection sends a document back to draft with a mandatory reason. Requisitions require at least 3 vendor invitations before award. POs printed while Approved automatically move to Sent.`,
  },
  {
    h: "7. Inventory costing",
    body: `FIFO layers are created at GRN and consumed at Issue/Delivery. Weighted Average cost is also maintained on the item. Stock Movements page shows every in/out with reference. Slow-moving (>90d) and Dead-stock (>180d) reports available under Warehouse Reports.`,
  },
  {
    h: "8. Cash management",
    body: `Bank Accounts support Checking, Savings, and Cash/Petty Cash types. Opening balance is editable only while zero. Cash accounts get a one-click Expense button for petty cash payouts (balanced JE, DR expense / CR cash). Bank Statement export in PDF or Excel with running balance.`,
  },
  {
    h: "9. Projects & budgets",
    body: `Inventory Issues and AP Invoices can be tagged to a Project — cost flows into Project Costs and updates the Project P&L. Budgets create Commitments on PO approval and Consumption on Invoice posting; Budget Reports show variance.`,
  },
  {
    h: "10. Vendor & Staff portals",
    body: `Vendor Portal (/vendor-portal): vendors self-register, accept POs, submit quotes for RFQs, and drop invoices. Staff Portal (/staff-portal): employees view payslips, submit leave and expense claims. Both use separate logins from the main app.`,
  },
  {
    h: "11. Admin readiness checklist",
    body: `Before go-live: (1) Seed Chart of Accounts. (2) Run Opening Balances wizard (Trial Balance, Open AP, Open AR, Inventory, Fixed Assets). (3) Generate Fiscal Periods. (4) Configure Tax rates. (5) Create Departments, Locations, Users & Roles. (6) Run System Health Check — all green. (7) Test backup + verify. (8) Train each role using the flow diagrams above.`,
  },
  {
    h: "12. Where to look when something breaks",
    body: `• "Cannot post" → check Fiscal Period lock and journal balance.
• "Invoice on hold" → Match Exceptions page.
• "Inventory won't decrease" → check reservations and location.
• "User can't see menu" → Roles & Permissions (app_role_permissions).
• "Report doesn't match GL" → Inventory Valuation reconciliation tab, or Trial Balance.
• System Health Check page runs 20+ automated diagnostics.`,
  },
];

export default function CreatorHandbook() {
  const rendered = useRef(false);

  useEffect(() => {
    if (rendered.current) return;
    rendered.current = true;
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      flowchart: { htmlLabels: true, curve: "basis" },
    });
    diagrams.forEach(async (d) => {
      const el = document.getElementById(`mmd-${d.id}`);
      if (!el) return;
      try {
        const { svg } = await mermaid.render(`svg-${d.id}`, d.code);
        el.innerHTML = svg;
      } catch (e) {
        el.innerHTML = `<pre class="text-xs">${d.code}</pre>`;
      }
    });
  }, []);

  const handlePrint = () => window.print();

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 print:p-0">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              Creator's Handbook
            </h1>
            <p className="text-muted-foreground mt-1">
              The complete mental model of the ERP — read this before training users.
            </p>
          </div>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Flow Diagrams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {diagrams.map((d) => (
              <div key={d.id}>
                <h3 className="font-semibold mb-2">{d.title}</h3>
                <div
                  id={`mmd-${d.id}`}
                  className="border rounded-md p-4 bg-white overflow-x-auto flex justify-center"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How the system thinks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections.map((s) => (
              <section key={s.h}>
                <h3 className="font-semibold text-lg mb-1">{s.h}</h3>
                <p className="text-sm whitespace-pre-line leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </section>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trainer's quick script (per role)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p><strong>Requester:</strong> Requisitions → New → add lines → Submit for approval.</p>
            <p><strong>Manager:</strong> Notifications bell → open PR → Approve or Reject (with reason).</p>
            <p><strong>Buyer:</strong> Requisition → Invite 3 Vendors → collect quotes → Award → Convert to PO → Send.</p>
            <p><strong>Warehouse:</strong> PO → Create GRN → enter received qty → Post. Stock and FIFO update automatically.</p>
            <p><strong>AP Clerk:</strong> Invoice Inbox → Log Vendor Invoice OR review portal submission → confirm 3-way match → Post.</p>
            <p><strong>Finance Manager:</strong> AP Payments → select invoices → allocate (full or partial) → Post → Bank Reconciliation.</p>
            <p><strong>Sales:</strong> Quotation → convert to Sales Order → Delivery Note → AR Invoice → AR Receipt.</p>
            <p><strong>Admin:</strong> Users, Roles, Approval Rules, Fiscal Periods, Backups, System Health Check.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
