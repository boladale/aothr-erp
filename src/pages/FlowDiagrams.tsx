import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Printer, Download, GitBranch } from "lucide-react";
import mermaid from "mermaid";

type Diagram = { id: string; title: string; desc: string; code: string };

const diagrams: Diagram[] = [
  {
    id: "p2p",
    title: "1. Procure-to-Pay (P2P) — End to End",
    desc: "From a staff request all the way to bank payment and reconciliation, with every role, document, and GL impact.",
    code: `flowchart TD
  subgraph REQ[Requester / Department]
    R1[Create Requisition<br/>Draft]
    R2[Submit for Approval]
  end
  subgraph MGR[Manager / Approver]
    A1{Approve?}
    A2[Reject with Reason<br/>→ back to Draft]
  end
  subgraph BUY[Procurement / Buyer]
    B1[Invite 3 Vendors<br/>RFQ]
    B2[Collect Bids]
    B3[Award Winning Bid]
    B4[Convert to PO<br/>Draft]
    B5[Approve & Send PO]
  end
  subgraph VEN[Vendor Portal]
    V1[Acknowledge PO]
    V2[Deliver Goods]
    V3[Submit Invoice]
  end
  subgraph WH[Warehouse]
    W1[Create GRN<br/>Weigh Bill required]
    W2[Post GRN]
    W3[Inventory + FIFO Layer +<br/>DR 1400 Inventory<br/>CR 2200 GR/IR Accrual]
  end
  subgraph AP[AP Clerk]
    P1[Log / Receive Invoice]
    P2{3-Way Match<br/>PO=GRN=INV?}
    P3[Match Exceptions Hold]
    P4[Post Invoice<br/>DR 2200 Accrual + VAT<br/>CR 2100 AP]
  end
  subgraph FIN[Finance Manager]
    F1[AP Payment<br/>Full or Partial]
    F2[Post Payment<br/>DR 2100 AP<br/>CR 1010 Bank]
    F3[Bank Reconciliation]
  end

  R1 --> R2 --> A1
  A1 -->|No| A2 --> R1
  A1 -->|Yes| B1 --> B2 --> B3 --> B4 --> B5 --> V1 --> V2 --> W1 --> W2 --> W3
  V3 --> P1
  W3 --> P1
  P1 --> P2
  P2 -->|Exception| P3 --> P1
  P2 -->|Match| P4 --> F1 --> F2 --> F3`,
  },
  {
    id: "o2c",
    title: "2. Order-to-Cash (O2C) — End to End",
    desc: "Customer inquiry through cash collection, including stock reservation, delivery, VAT invoice and receipt.",
    code: `flowchart TD
  subgraph SLS[Sales]
    S1[Sales Quotation<br/>Draft]
    S2[Send to Customer]
    S3[Convert to Sales Order]
  end
  subgraph INV[Inventory Engine]
    I1[Reserve Stock<br/>On Hand unchanged<br/>Reserved +]
    I2{Available >= Qty?}
    I3[Block — Oversell Prevented]
  end
  subgraph WH[Warehouse]
    D1[Create Delivery Note]
    D2[Post Delivery<br/>Inventory -<br/>FIFO consumed<br/>DR 5100 COGS<br/>CR 1400 Inventory]
  end
  subgraph AR[AR / Finance]
    R1[Create AR Invoice<br/>VAT computed from tax rate]
    R2[Post Invoice<br/>DR 1200 AR<br/>CR 4000 Revenue<br/>CR 2300 VAT Payable]
    R3[Send to Customer]
    R4[AR Receipt<br/>Full or Partial]
    R5[Post Receipt<br/>DR 1010 Bank<br/>CR 1200 AR]
    R6[Bank Reconciliation]
  end

  S1 --> S2 --> S3 --> I2
  I2 -->|No| I3
  I2 -->|Yes| I1 --> D1 --> D2 --> R1 --> R2 --> R3 --> R4 --> R5 --> R6`,
  },
  {
    id: "inv",
    title: "3. Inventory Lifecycle — End to End",
    desc: "Every movement in and out of the warehouse and how each hits the ledger and reports.",
    code: `flowchart TD
  IN1[GRN from PO] --> BAL[Inventory Balance<br/>+ FIFO Layer]
  IN2[Opening Balance Wizard] --> BAL
  IN3[Adjustment +] --> BAL

  BAL --> OUT1[Issue to Dept/Project<br/>DR Expense / CR 1400<br/>FIFO consumed]
  BAL --> OUT2[Transfer Out → Transfer In<br/>Source - / Dest +]
  BAL --> OUT3[Delivery Note<br/>COGS posted]
  BAL --> OUT4[Adjustment -]

  OUT1 --> RET[Issue Return<br/>Restores stock + reverses GL]
  RET --> BAL

  BAL --> RPT1[Valuation Report]
  BAL --> RPT2[Stock Movements]
  BAL --> RPT3[Slow Moving > 90d]
  BAL --> RPT4[Dead Stock > 180d]
  RPT1 -.reconciles to.-> BS[Balance Sheet<br/>1400 Inventory]`,
  },
  {
    id: "gl",
    title: "4. Record-to-Report (R2R) — GL & Period Close",
    desc: "How sub-ledger activity rolls up into financial statements and how a period is locked.",
    code: `flowchart TD
  subgraph SUB[Sub-ledgers]
    AP[AP Invoices & Payments]
    AR[AR Invoices & Receipts]
    INV[Inventory Movements]
    PAY[Payroll]
    FA[Fixed Assets<br/>Depreciation + Disposal]
    CN[Credit Notes AR/AP]
    MAN[Manual Journals<br/>Draft / Post / Reverse]
  end
  SUB --> JE[GL Journal Entries<br/>Debit = Credit enforced]
  JE --> GL[General Ledger]
  GL --> TB[Trial Balance]
  TB --> PL[P&L Statement]
  TB --> BS[Balance Sheet]
  TB --> CF[Cash Flow Statement]
  GL --> LOCK[Fiscal Period Lock<br/>blocks further posting]
  LOCK --> YEC[Year-End Close Wizard<br/>Revenue + Expense<br/>→ 3200 Retained Earnings]
  YEC --> NEWYR[New Fiscal Year Opens]`,
  },
  {
    id: "cash",
    title: "5. Cash & Bank — End to End",
    desc: "All cash movement channels and how they reach reconciliation and reporting.",
    code: `flowchart LR
  subgraph SRC[Sources of Cash Movement]
    A[AP Payment]
    B[AR Receipt]
    C[Fund Transfer<br/>between accounts]
    D[Petty Cash Expense<br/>one-click]
    E[Bank Statement Import<br/>CSV / AI reconcile]
  end
  SRC --> BA[Bank Accounts<br/>Checking / Savings / Cash]
  BA --> BT[Bank Transactions Ledger]
  BT --> BR[Bank Reconciliation<br/>Manual / AI / CSV]
  BR --> STMT[Bank Statement Export<br/>PDF or Excel]
  BR --> RPT[Cash Reports & Forecast]`,
  },
  {
    id: "assets",
    title: "6. Fixed Assets — End to End",
    desc: "Acquisition through depreciation to disposal with GL impact at each stage.",
    code: `flowchart LR
  ACQ[Acquire Asset<br/>Category + Department<br/>DR 1500 Asset<br/>CR 1010/2100] --> REG[Asset Register]
  REG --> DEP[Monthly Depreciation Run<br/>DR 5200 Depreciation Exp<br/>CR 1510 Accum. Depr.]
  DEP --> NBV[Net Book Value]
  NBV --> DISP{Disposal?}
  DISP -->|Sell| SL[Compute Gain/Loss<br/>DR 1010 Bank<br/>DR 1510 Accum. Depr.<br/>CR 1500 Asset<br/>DR/CR Gain/Loss]
  DISP -->|Write off| WO[Write-off JE]`,
  },
  {
    id: "budget",
    title: "7. Budgeting & Commitments",
    desc: "How budgets consume through the P2P cycle and where variance shows up.",
    code: `flowchart LR
  BGT[Budget Created<br/>per GL Account + Period] --> AVL[Available Budget]
  PR[Requisition Approved] -.soft check.-> AVL
  PO[PO Approved] -->|Commitment +| AVL
  INV[AP Invoice Posted] -->|Consumption +<br/>Commitment -| AVL
  AVL --> RPT[Budget vs Actual Report<br/>Variance %]`,
  },
  {
    id: "project",
    title: "8. Project Costing & Profitability",
    desc: "Every cost and revenue path that flows into a Project P&L.",
    code: `flowchart TD
  P[Project Master] --> C1[Inventory Issue tagged to Project<br/>→ project_costs]
  P --> C2[AP Invoice line tagged to Project<br/>→ project_costs]
  P --> C3[Payroll allocation<br/>→ project_costs]
  P --> R1[AR Invoice tagged to Project<br/>→ project_revenues]
  P --> R2[Milestone billing]
  C1 & C2 & C3 --> COST[Total Actual Costs]
  R1 & R2 --> REV[Total Revenue]
  COST & REV --> PNL[Project P&L<br/>Profitability Report]`,
  },
  {
    id: "hr",
    title: "9. HR & Payroll — End to End",
    desc: "Employee lifecycle from hire through payslip and its GL posting.",
    code: `flowchart TD
  H1[Hire Employee] --> H2[Assign Department + Pay Grade + Salary Components]
  H2 --> ATT[Attendance & Leave]
  ATT --> RUN[Payroll Run<br/>compute gross/deductions/net]
  RUN --> POST[Post Payroll<br/>DR 5300 Salary Expense<br/>CR 2400 Payroll Payable<br/>CR 2500 Tax/Pension]
  POST --> SLP[Payslips Generated]
  SLP --> ESS[Staff Portal<br/>View Payslip]
  POST --> PAY[Bank Payment to Employees]`,
  },
  {
    id: "vendor",
    title: "10. Vendor Onboarding & Self-Service",
    desc: "Two paths to become a vendor and everything a vendor can do afterwards.",
    code: `flowchart TD
  PATH1[Self-Registration<br/>/vendor-portal/login] --> REV[Admin Review<br/>Vendor Registrations page]
  PATH2[Admin Invite Token] --> REV
  REV -->|Approve| VEN[Active Vendor + Portal Login]
  REV -->|Reject| END[Rejected]
  VEN --> ACT1[Acknowledge POs]
  VEN --> ACT2[Submit Quotes for RFQ]
  VEN --> ACT3[Submit Invoices]
  VEN --> ACT4[Upload Documents<br/>RC, Bank, Tax]
  BLK{Blacklist?} -->|Requires reason<br/>+ Manager approval| VEN`,
  },
  {
    id: "admin",
    title: "11. Go-Live / Cutover Sequence",
    desc: "The one-time setup path a new organization must complete before transacting.",
    code: `flowchart LR
  S1[Create Organization<br/>+ Branding] --> S2[Seed Chart of Accounts]
  S2 --> S3[Generate Fiscal Periods<br/>12 months]
  S3 --> S4[Configure Tax Rates]
  S4 --> S5[Departments, Locations,<br/>Items, Vendors, Customers]
  S5 --> S6[Users, Roles, Approval Rules]
  S6 --> S7[Opening Balances Wizard<br/>TB + Open AP + Open AR<br/>+ Inventory + Fixed Assets]
  S7 --> S8[Close Pre-Cutover Periods]
  S8 --> S9[System Health Check<br/>all green]
  S9 --> LIVE[GO LIVE]`,
  },
];

export default function FlowDiagrams() {
  const [active, setActive] = useState(diagrams[0].id);
  const rendered = useRef<Set<string>>(new Set());


  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      flowchart: { htmlLabels: true, curve: "basis" },
    });
    // Pre-render all diagrams so print includes them.
    diagrams.forEach(async (d) => {
      if (rendered.current.has(d.id)) return;
      try {
        const { svg } = await mermaid.render(`svg-${d.id}`, d.code);
        const el = document.getElementById(`mmd-${d.id}`);
        if (el) {
          el.innerHTML = svg;
          rendered.current.add(d.id);
        }
      } catch {
        /* ignore */
      }
    });
  }, []);

  const handlePrint = () => window.print();

  const downloadSVG = (id: string, title: string) => {
    const el = document.getElementById(`mmd-${id}`);
    const svg = el?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-0">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <GitBranch className="h-7 w-7 text-primary" />
              End-to-End Flow Diagrams
            </h1>
            <p className="text-muted-foreground mt-1">
              Every major business cycle mapped from start to finish, with roles and GL impact.
            </p>
          </div>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save All as PDF
          </Button>
        </div>

        <Tabs value={active} onValueChange={setActive} className="print:hidden">
          <TabsList className="flex flex-wrap h-auto">
            {diagrams.map((d) => (
              <TabsTrigger key={d.id} value={d.id} className="text-xs">
                {d.title.split(" — ")[0].replace(/^\d+\.\s*/, "")}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Screen: only active tab. Print: all diagrams. */}
        {diagrams.map((d) => (
          <Card
            key={d.id}
            className={`${active === d.id ? "block" : "hidden"} print:block print:break-inside-avoid print:mb-6`}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{d.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{d.desc}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadSVG(d.id, d.title)}
                  className="print:hidden shrink-0"
                >
                  <Download className="mr-2 h-3 w-3" /> SVG
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                id={`mmd-${d.id}`}
                className="border rounded-md p-4 bg-white overflow-x-auto flex justify-center min-h-[200px]"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
