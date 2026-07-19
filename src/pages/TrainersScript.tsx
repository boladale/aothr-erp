import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, GraduationCap, CheckCircle2 } from "lucide-react";

type Step = { action: string; where: string; expect: string };
type Role = {
  id: string;
  role: string;
  persona: string;
  goal: string;
  prereq: string[];
  scenarios: { title: string; steps: Step[]; tip?: string }[];
};

const roles: Role[] = [
  {
    id: "requester",
    role: "Requester (Staff)",
    persona: "Any staff member who needs to buy something.",
    goal: "Raise a purchase requisition and track it to delivery.",
    prereq: ["Active user account", "Assigned to a Department", "Requester role"],
    scenarios: [
      {
        title: "Raise a new requisition",
        tip: "You can only edit while the PR is in DRAFT.",
        steps: [
          { action: "Click Requisitions in the sidebar", where: "/requisitions", expect: "List of requisitions loads" },
          { action: "Click New Requisition", where: "Top-right button", expect: "Form opens" },
          { action: "Fill Department, Requested By (your name), Needed By, Justification", where: "Header fields", expect: "All required fields green" },
          { action: "Add lines: Item, Qty, Estimated Unit Price", where: "Line items table", expect: "Line total auto-calculates with commas (e.g. 50,000.00)" },
          { action: "Save as Draft, then Submit for Approval", where: "Footer buttons", expect: "Status flips to Pending Approval; PR-XXXX number generated" },
        ],
      },
      {
        title: "Track your requisition",
        steps: [
          { action: "Open Notifications bell", where: "Top bar", expect: "You are notified on approve/reject and PO creation" },
          { action: "Open the PR", where: "Requisitions list", expect: "Timeline shows Approvals → RFQ → PO → GRN" },
        ],
      },
    ],
  },
  {
    id: "manager",
    role: "Department Manager (Approver)",
    persona: "Head of Department who approves staff requests.",
    goal: "Review and approve or reject requisitions and POs.",
    prereq: ["Approver role", "Assigned as approver in Approval Rules"],
    scenarios: [
      {
        title: "Approve a requisition",
        steps: [
          { action: "Click Notifications bell → open the pending PR", where: "Top bar", expect: "PR opens in review mode" },
          { action: "Review lines, budget indicator, justification", where: "PR detail page", expect: "Budget widget shows remaining budget" },
          { action: "Click Approve (or Reject with a reason)", where: "Footer", expect: "Rejection reason is mandatory; requester is notified" },
        ],
      },
    ],
  },
  {
    id: "buyer",
    role: "Buyer / Procurement Officer",
    persona: "Runs sourcing, RFQs, and issues POs.",
    goal: "Turn approved requisitions into competitive POs.",
    prereq: ["Procurement role", "At least 3 active vendors per category"],
    scenarios: [
      {
        title: "Run an RFQ and award",
        tip: "Minimum of 3 vendor invites is enforced.",
        steps: [
          { action: "Open the approved PR", where: "/requisitions → open PR", expect: "Bid Collection panel visible" },
          { action: "Click Invite Vendors → pick at least 3 vendors → Send", where: "Bid panel", expect: "Vendors get portal invitations" },
          { action: "Enter received quotes (or vendors submit via portal)", where: "Bid panel", expect: "Comparison grid ranks by price/terms" },
          { action: "Click Award to the winning vendor", where: "Bid panel", expect: "Award locks vendor + pricing" },
          { action: "Convert to PO (optionally tick 'Send directly to vendor')", where: "Convert dialog", expect: "PO created; if chosen, auto-approved and sent" },
        ],
      },
      {
        title: "Send / print PO",
        steps: [
          { action: "Open PO → Print / Send", where: "/purchase-orders → open PO", expect: "Approved PO auto-transitions to Sent on print" },
        ],
      },
    ],
  },
  {
    id: "warehouse",
    role: "Warehouse / Store Officer",
    persona: "Receives goods, issues stock, manages transfers.",
    goal: "Keep inventory accurate at every location.",
    prereq: ["Warehouse role", "Locations set up"],
    scenarios: [
      {
        title: "Receive goods (GRN)",
        steps: [
          { action: "Open Goods Receipts → New GRN", where: "/goods-receipts", expect: "Pick from Sent / Partially Received POs only" },
          { action: "Enter Waybill number, attach delivery doc", where: "Header", expect: "Waybill is mandatory" },
          { action: "Enter received Qty per line (cannot exceed PO qty)", where: "Lines", expect: "Auto-clamped" },
          { action: "Click Post", where: "Footer", expect: "Inventory ↑, FIFO layer created, JE: DR Inventory / CR Accrual" },
        ],
      },
      {
        title: "Issue stock to a department/project",
        steps: [
          { action: "Inventory Issues → New Issue", where: "/inventory-issues", expect: "Form opens" },
          { action: "Select Department (dropdown), optional Project, Item, Qty", where: "Form", expect: "Project cost updates if selected" },
          { action: "Post", where: "Footer", expect: "FIFO consumed, JE: DR Expense / CR Inventory" },
        ],
      },
      {
        title: "Transfer between locations",
        steps: [
          { action: "Transfers → New Transfer → From/To locations, lines → Post", where: "/inventory-transfers", expect: "Source ↓, Destination ↑; both events shown in Stock Movements" },
        ],
      },
      {
        title: "Return an issue",
        steps: [
          { action: "Open the issue → Return", where: "/inventory-issues → open", expect: "Stock restored, GL and Project cost reversed" },
        ],
      },
    ],
  },
  {
    id: "ap",
    role: "AP Clerk",
    persona: "Handles vendor invoices and prepares payments.",
    goal: "Match invoices to POs/GRNs and post cleanly to GL.",
    prereq: ["AP role", "Tax configuration active"],
    scenarios: [
      {
        title: "Log a vendor invoice",
        steps: [
          { action: "Invoice Inbox → Log Vendor Invoice (or open portal submission)", where: "/invoice-inbox", expect: "Dialog opens" },
          { action: "Pick Vendor, PO, GRN → lines auto-fill", where: "Dialog", expect: "3-Way Match panel shows PO ✓ GRN ✓ Invoice ✓" },
          { action: "Confirm VAT % (from Tax Config)", where: "Totals", expect: "Tax computed and posted to tax GL" },
          { action: "Post", where: "Footer", expect: "If mismatch → Match Exceptions; else JE posted" },
        ],
      },
      {
        title: "Credit note against a vendor",
        steps: [
          { action: "AP Credit Notes → New → link invoice → Post", where: "/ap-credit-notes", expect: "Reduces payable; appears on Vendor Statement" },
        ],
      },
    ],
  },
  {
    id: "finance",
    role: "Finance Manager",
    persona: "Owns GL, payments, period close, and reporting.",
    goal: "Keep books accurate, pay vendors, close periods.",
    prereq: ["Finance Manager role", "Fiscal periods generated"],
    scenarios: [
      {
        title: "Pay vendors",
        steps: [
          { action: "AP Payments → New → pick vendor & invoices", where: "/ap-payments", expect: "Allocation editable; overpayment blocked" },
          { action: "Choose bank account, date, reference → Post", where: "Form", expect: "JE: DR AP / CR Bank; bank balance updates" },
        ],
      },
      {
        title: "Journal entry & reversal",
        steps: [
          { action: "Journal Entries → New → add balanced DR/CR lines → Save Draft → Post", where: "/journal-entries", expect: "Unbalanced entries rejected" },
          { action: "Reverse a posted JE if needed", where: "Open JE → Reverse", expect: "Reversal JE created with audit link" },
        ],
      },
      {
        title: "Bank reconciliation",
        steps: [
          { action: "Bank Reconciliation → pick account → import statement (CSV) or auto-match", where: "/bank-reconciliation", expect: "Matched / Unmatched lists; save reconciliation" },
        ],
      },
      {
        title: "Month-end close",
        steps: [
          { action: "Run Trial Balance & Financial Reports", where: "/financial-reports", expect: "Inventory balance = Inventory Valuation total" },
          { action: "Fiscal Periods → Close the month", where: "/fiscal-periods", expect: "Postings to closed periods are rejected" },
        ],
      },
    ],
  },
  {
    id: "sales",
    role: "Sales / AR Officer",
    persona: "Owns quotes, orders, deliveries, and customer receipts.",
    goal: "Convert quotes to cash.",
    prereq: ["Sales role", "Customers set up"],
    scenarios: [
      {
        title: "Quote to Cash",
        steps: [
          { action: "Sales Quotations → New → send to customer", where: "/sales-quotations", expect: "Quote number generated" },
          { action: "Convert to Sales Order (reserves stock)", where: "Quote → Convert", expect: "Inventory reservation created" },
          { action: "Delivery Note → Post (drops stock + COGS)", where: "/delivery-notes", expect: "JE: DR COGS / CR Inventory" },
          { action: "AR Invoice → Post (VAT auto-applied)", where: "/ar-invoices", expect: "Customer receivable created" },
          { action: "AR Receipt → allocate to invoice", where: "/ar-receipts", expect: "Full or partial; overpayment blocked" },
        ],
      },
    ],
  },
  {
    id: "admin",
    role: "System Administrator",
    persona: "Owns setup, users, roles, and platform health.",
    goal: "Keep the system configured, secure, and backed up.",
    prereq: ["Admin role"],
    scenarios: [
      {
        title: "First-time setup",
        steps: [
          { action: "Seed Chart of Accounts", where: "/chart-of-accounts", expect: "Standard COA loaded" },
          { action: "Generate Fiscal Periods (12 months)", where: "/fiscal-periods", expect: "All periods created and open" },
          { action: "Tax Configuration → set active VAT rate", where: "/tax-configuration", expect: "Rate visible on invoices" },
          { action: "Departments, Locations, Users, Roles", where: "Admin menu", expect: "All master data seeded" },
          { action: "Opening Balances wizard → TB, Open AP, Open AR, Inventory, Fixed Assets", where: "/opening-balances", expect: "Cutover balances posted" },
          { action: "Run System Health Check", where: "/system-health", expect: "All checks green" },
        ],
      },
      {
        title: "Users & permissions",
        steps: [
          { action: "User Management → Create User → assign role", where: "/user-management", expect: "User can only see menus their role permits" },
          { action: "Approval Rules → define thresholds & approvers", where: "/approval-rules", expect: "Documents route correctly" },
        ],
      },
      {
        title: "Backups",
        steps: [
          { action: "Admin → Backup Management → Run backup → Verify", where: "/admin", expect: "Backup completes with verification hash" },
        ],
      },
    ],
  },
  {
    id: "vendor",
    role: "Vendor (External Portal)",
    persona: "Supplier interacting via the Vendor Portal.",
    goal: "Respond to RFQs, accept POs, drop invoices.",
    prereq: ["Vendor invitation email", "Vendor Portal login"],
    scenarios: [
      {
        title: "Respond to an RFQ",
        steps: [
          { action: "Login → Quote Requests → open RFQ", where: "/vendor-portal", expect: "RFQ lines visible" },
          { action: "Enter unit prices, delivery, payment terms → Submit", where: "Quote form", expect: "Buyer sees your bid in comparison" },
        ],
      },
      {
        title: "Accept PO and submit invoice",
        steps: [
          { action: "Purchase Orders → Accept", where: "/vendor-portal", expect: "Buyer notified" },
          { action: "After delivery → Submit Invoice → attach doc", where: "/vendor-portal", expect: "Lands in AP Invoice Inbox" },
        ],
      },
    ],
  },
];

export default function TrainersScript() {
  const handlePrint = () => window.print();
  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-0">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-primary" />
              Trainer's Script
            </h1>
            <p className="text-muted-foreground mt-1">
              Step-by-step click paths per role. Use this to run live training sessions.
            </p>
          </div>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>

        <Tabs defaultValue={roles[0].id} className="print:hidden">
          <TabsList className="flex flex-wrap h-auto">
            {roles.map((r) => (
              <TabsTrigger key={r.id} value={r.id}>{r.role}</TabsTrigger>
            ))}
          </TabsList>
          {roles.map((r) => (
            <TabsContent key={r.id} value={r.id}>
              <RoleCard role={r} />
            </TabsContent>
          ))}
        </Tabs>

        {/* Print view: all roles stacked */}
        <div className="hidden print:block space-y-6">
          {roles.map((r) => <RoleCard key={r.id} role={r} />)}
        </div>
      </div>
    </AppLayout>
  );
}

function RoleCard({ role }: { role: Role }) {
  return (
    <Card className="mt-4 print:break-inside-avoid">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{role.role}</span>
          <Badge variant="secondary">{role.scenarios.length} scenarios</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{role.persona}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-3 rounded-md bg-muted/40">
            <p className="text-xs uppercase font-semibold text-muted-foreground">Goal</p>
            <p className="text-sm">{role.goal}</p>
          </div>
          <div className="p-3 rounded-md bg-muted/40">
            <p className="text-xs uppercase font-semibold text-muted-foreground">Prerequisites</p>
            <ul className="text-sm list-disc list-inside">
              {role.prereq.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        </div>

        {role.scenarios.map((s, i) => (
          <div key={s.title} className="border rounded-md p-4">
            <h4 className="font-semibold mb-1">Scenario {i + 1}: {s.title}</h4>
            {s.tip && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">⚠ {s.tip}</p>
            )}
            <ol className="space-y-2">
              {s.steps.map((step, idx) => (
                <li key={idx} className="grid grid-cols-[24px_1fr] gap-2 text-sm">
                  <span className="font-mono text-muted-foreground">{idx + 1}.</span>
                  <div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span><strong>{step.action}</strong> <span className="text-muted-foreground">— {step.where}</span></span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Expected: {step.expect}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
