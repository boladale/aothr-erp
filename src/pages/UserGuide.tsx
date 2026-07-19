import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Building2, Package, MapPin, ClipboardList, FileText,
  Boxes, DollarSign, Truck, BookOpen, Calculator,
  Receipt, CreditCard, Users, Landmark, ArrowRightLeft,
  TrendingUp, FolderKanban, ShoppingCart, FileCheck,
  Shield, Settings, BarChart3, FileSearch, HelpCircle,
  Lightbulb, ArrowRight, CheckCircle2, UserCog, Wallet,
  Briefcase, Percent, HardDrive, Printer, Store, Activity,
  Banknote, Building,
} from 'lucide-react';

const Step = ({ number, children }: { number: number; children: React.ReactNode }) => (
  <div className="flex gap-3 items-start">
    <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">
      {number}
    </span>
    <p className="text-sm text-muted-foreground pt-0.5">{children}</p>
  </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 items-start p-3 rounded-lg bg-accent/50 border border-accent">
    <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
    <p className="text-xs text-muted-foreground">{children}</p>
  </div>
);

const Flow = ({ steps }: { steps: string[] }) => (
  <div className="flex flex-wrap items-center gap-1 text-xs">
    {steps.map((step, i) => (
      <span key={i} className="flex items-center gap-1">
        <Badge variant="secondary" className="text-xs">{step}</Badge>
        {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
      </span>
    ))}
  </div>
);

const Sub = ({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <h4 className="font-semibold flex items-center gap-2">
      <Icon className="h-4 w-4" /> {title}
    </h4>
    {children}
  </div>
);

export default function UserGuide() {
  return (
    <AppLayout>
      <div className="page-container space-y-8 max-w-4xl mx-auto pb-16 print:p-0">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <PageHeader
            title="User Guide"
            description="Complete walkthrough of every module — plain-language, click-by-click."
          />
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
          </Button>
        </div>

        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              What this system does
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A complete ERP covering <strong>Procurement, Warehouse & Inventory, Sales,
              Finance (GL / AP / AR / Cash / Fixed Assets), Projects, Budgets, HR & Payroll,</strong>
              and self-service <strong>Staff & Vendor portals</strong>. Default currency is Naira (₦).
              Every organization's data is isolated — you only see your own.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: ShoppingCart, label: 'Procurement' },
                { icon: Boxes, label: 'Inventory' },
                { icon: FileCheck, label: 'Sales' },
                { icon: BookOpen, label: 'Finance / GL' },
                { icon: Wallet, label: 'Cash & Bank' },
                { icon: HardDrive, label: 'Fixed Assets' },
                { icon: FolderKanban, label: 'Projects & Budgets' },
                { icon: Users, label: 'HR & Payroll' },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-lg bg-muted/50 text-center space-y-1">
                  <m.icon className="h-6 w-6 mx-auto text-primary" />
                  <p className="text-xs font-medium">{m.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Golden Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Golden rules (memorize these)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• You can only <strong>edit or delete a transaction while it is in Draft</strong>.</p>
            <p>• Every posting produces a <strong>balanced journal entry</strong> (debits = credits).</p>
            <p>• <strong>Inventory can never go negative</strong> — the system blocks it.</p>
            <p>• Master data with history can only be <strong>deactivated</strong>, not deleted.</p>
            <p>• Postings to a <strong>locked fiscal period</strong> are rejected.</p>
            <p>• Blacklisting a vendor needs a <strong>reason + manager approval</strong>.</p>
            <p>• Document numbers (PR-, PO-, GRN-, INV-, etc.) are generated automatically.</p>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Getting started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Step number={1}><strong>Sign in</strong> at the login page. You land on the Dashboard for your role.</Step>
            <Step number={2}><strong>Left sidebar</strong> holds every module — grouped as Procurement, Warehouse, Sales, Finance, HR, Admin.</Step>
            <Step number={3}><strong>Notifications bell</strong> (top-right) shows approvals waiting for you.</Step>
            <Step number={4}><strong>Your role</strong> controls which menus you see. Admins configure this under Administration → User Management.</Step>
            <Tip>Before real use, an Admin must complete: Chart of Accounts → Fiscal Periods → Tax Config → Departments & Locations → Users & Roles → Opening Balances → System Health Check.</Tip>
          </CardContent>
        </Card>

        <Separator />

        <h2 className="text-xl font-bold text-foreground">Module-by-module guide</h2>

        <Accordion type="multiple" className="space-y-2">
          {/* PROCUREMENT */}
          <AccordionItem value="procurement" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Procurement (buying)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Flow steps={['Requisition', 'RFQ (3 vendors)', 'Award', 'PO', 'GRN', 'Vendor Invoice', '3-Way Match', 'Payment']} />

              <Sub icon={Building2} title="Vendors">
                <p className="text-sm text-muted-foreground">Companies you buy from. Store bank details, RC number, category, payment terms.</p>
                <Step number={1}>Vendors → <strong>Add Vendor</strong> → fill KYC → Save.</Step>
                <Step number={2}>To blacklist: open vendor → <strong>Blacklist</strong> → enter reason → manager approves.</Step>
                <Step number={3}>Export list via <strong>Export CSV</strong>.</Step>
              </Sub>

              <Separator />
              <Sub icon={FileSearch} title="Requisitions">
                <p className="text-sm text-muted-foreground">A staff request to buy something. Requires the requester's name and department.</p>
                <Step number={1}>Requisitions → <strong>New</strong> → enter Requested By, department, lines, quantities.</Step>
                <Step number={2}>Submit for approval. Approver gets a bell notification.</Step>
                <Step number={3}>Once approved, either invite vendors for quotes OR convert directly to PO.</Step>
              </Sub>

              <Separator />
              <Sub icon={FileText} title="RFQs (Request for Quotation)">
                <p className="text-sm text-muted-foreground">Ask multiple vendors for prices. <strong>Minimum 3 vendors</strong> must be invited.</p>
                <Step number={1}>From an approved requisition → <strong>Invite 3 Vendors</strong>.</Step>
                <Step number={2}>Vendors log bids manually OR via the Vendor Portal.</Step>
                <Step number={3}>Compare in Bid Collection panel → <strong>Award</strong> the winner → auto-creates PO.</Step>
              </Sub>

              <Separator />
              <Sub icon={FileText} title="Purchase Orders">
                <p className="text-sm text-muted-foreground">The official order sent to a vendor.</p>
                <Step number={1}>PO created from award (or directly). Payment terms support Advance, Partial, Net-30, or custom text.</Step>
                <Step number={2}>Approve → optionally tick <strong>"send directly to vendor after creation"</strong> to auto-dispatch.</Step>
                <Step number={3}>Printing an Approved PO auto-moves it to Sent.</Step>
                <Tip>Draft POs and draft lines can be deleted. Once posted, only reverse or credit-note.</Tip>
              </Sub>

              <Separator />
              <Sub icon={Truck} title="Goods Receipt Notes (GRN)">
                <p className="text-sm text-muted-foreground">Confirm what physically arrived.</p>
                <Step number={1}>PO → <strong>Create GRN</strong> → enter received quantity (may be less than ordered) → attach weigh-bill.</Step>
                <Step number={2}>Post. Inventory increases; DR Inventory / CR GR-IR Accrual is posted automatically.</Step>
              </Sub>

              <Separator />
              <Sub icon={Receipt} title="Vendor Invoices & 3-Way Match">
                <p className="text-sm text-muted-foreground">The vendor's bill. Must match PO and GRN quantities.</p>
                <Step number={1}>Vendors submit via portal, OR AP Clerk uses <strong>Log Vendor Invoice</strong>.</Step>
                <Step number={2}>VAT is calculated from active Tax Configuration.</Step>
                <Step number={3}>Three-Way Match panel shows PO ✓ GRN ✓ Invoice ✓. Mismatches go to <strong>Match Exceptions</strong>.</Step>
                <Step number={4}>Post when clean.</Step>
              </Sub>

              <Separator />
              <Sub icon={CreditCard} title="AP Payments & AP Credit Notes">
                <Step number={1}>AP Payments → select vendor → tick invoices to pay → allocate amounts (full or partial, cannot overpay).</Step>
                <Step number={2}>Post → cash decreases, AP decreases, bank transaction logged.</Step>
                <Step number={3}>For refunds/returns use <strong>AP Credit Notes</strong>.</Step>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* WAREHOUSE */}
          <AccordionItem value="warehouse" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-primary" /> Warehouse & Inventory
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Sub icon={Package} title="Items & Locations">
                <p className="text-sm text-muted-foreground">Items = catalogue. Locations = where stock is held (warehouses, offices).</p>
                <Step number={1}>Items → add code, name, UoM, reorder level, category.</Step>
                <Step number={2}>Locations → add warehouses/offices. Each is a stock-holding point.</Step>
              </Sub>

              <Separator />
              <Sub icon={Boxes} title="Inventory & Stock Movements">
                <p className="text-sm text-muted-foreground">Every in/out is logged. Costed by <strong>FIFO layers</strong> and Weighted Average.</p>
                <Step number={1}>Inventory page → current qty per item per location.</Step>
                <Step number={2}>Stock Movements → full audit trail (GRN in, Issue out, Transfer, Delivery, Return, Adjustment).</Step>
              </Sub>

              <Separator />
              <Sub icon={ArrowRightLeft} title="Inventory Issues (to Dept / Project)">
                <p className="text-sm text-muted-foreground">Consuming stock internally.</p>
                <Step number={1}>Inventory Issues → New → select Department (dropdown), optional Project, items, qty.</Step>
                <Step number={2}>Post → DR Expense (or Project Cost) / CR Inventory; FIFO consumed.</Step>
                <Step number={3}>To reverse: open issue → <strong>Return</strong> → restores stock, reverses GL and project cost.</Step>
              </Sub>

              <Separator />
              <Sub icon={ArrowRightLeft} title="Inventory Transfers">
                <Step number={1}>Transfers → New → source location, destination, items.</Step>
                <Step number={2}>Post → source decreases, destination increases; both events appear in Stock Movements.</Step>
              </Sub>

              <Separator />
              <Sub icon={DollarSign} title="Inventory Valuation & Warehouse Reports">
                <p className="text-sm text-muted-foreground">Value of stock always reconciles to GL Inventory account.</p>
                <Step number={1}>Inventory Valuation → filter by location/category/as-of date → export Excel → check <strong>GL Reconciliation</strong> tab.</Step>
                <Step number={2}>Warehouse Reports → Slow Moving (&gt;90d), Dead Stock (&gt;180d).</Step>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* SALES */}
          <AccordionItem value="sales" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Sales (Order-to-Cash)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Flow steps={['Quotation', 'Sales Order', 'Delivery Note', 'AR Invoice', 'AR Receipt']} />
              <Sub icon={FileCheck} title="Quotations & Sales Orders">
                <Step number={1}>Sales Quotations → New → customer, items, prices, VAT auto-applied.</Step>
                <Step number={2}>Convert accepted quote to Sales Order → stock is <strong>reserved</strong> (cannot be oversold).</Step>
              </Sub>
              <Separator />
              <Sub icon={Truck} title="Delivery Notes">
                <Step number={1}>SO → Create Delivery Note → enter dispatch location and quantities.</Step>
                <Step number={2}>Post → inventory drops at dispatch location; COGS posted (DR COGS / CR Inventory).</Step>
              </Sub>
              <Separator />
              <Sub icon={Receipt} title="AR Invoices, Receipts, Credit Notes">
                <Step number={1}>Invoices → New/AR Invoice → VAT calculated from Tax Configuration.</Step>
                <Step number={2}>AR Receipts → allocate customer payment (partial allowed, overpayment blocked).</Step>
                <Step number={3}>Returns handled via <strong>AR Credit Notes</strong>.</Step>
              </Sub>
              <Separator />
              <Sub icon={Users} title="Customers">
                <p className="text-sm text-muted-foreground">Master file with contact, tax, credit terms. Statement of Account & AR Aging available under Finance Reports.</p>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* FINANCE / GL */}
          <AccordionItem value="gl" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Finance — General Ledger
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Sub icon={BookOpen} title="Chart of Accounts (COA)">
                <p className="text-sm text-muted-foreground">All GL accounts organized by type. Search filters by name, code, type, or description.</p>
                <Step number={1}>Chart of Accounts → search or filter by account type → export Excel.</Step>
                <Step number={2}>Accounts with transactions cannot be deleted (only deactivated).</Step>
              </Sub>
              <Separator />
              <Sub icon={FileText} title="Journal Entries">
                <Step number={1}>Journal Entries → New → add debit/credit lines. System rejects unbalanced entries.</Step>
                <Step number={2}>Save as Draft to finish later, or Post immediately.</Step>
                <Step number={3}>Posted entries can be <strong>Reversed</strong> — creates opposite JE with audit trail.</Step>
                <Step number={4}>Filter by date/status/account → export Excel.</Step>
              </Sub>
              <Separator />
              <Sub icon={Calculator} title="Recurring Entries">
                <p className="text-sm text-muted-foreground">Set once, system creates JE monthly (rent, subscriptions, depreciation templates).</p>
              </Sub>
              <Separator />
              <Sub icon={Percent} title="Tax Configuration">
                <p className="text-sm text-muted-foreground">Define VAT rates and the GL accounts they post to. All AR/AP invoice posting reads this automatically.</p>
              </Sub>
              <Separator />
              <Sub icon={BarChart3} title="Financial Reports">
                <p className="text-sm text-muted-foreground">Trial Balance, P&amp;L, Balance Sheet, Cash Flow — all derived from posted JEs.</p>
                <Step number={1}>Financial Reports → pick date range → drill into any account.</Step>
                <Step number={2}>Balance Sheet Inventory line matches the Inventory Valuation total.</Step>
              </Sub>
              <Separator />
              <Sub icon={CheckCircle2} title="Fiscal Periods & Year-End Close">
                <Step number={1}>Fiscal Periods → Generate 12 monthly periods per year.</Step>
                <Step number={2}>Lock a period once reconciled — postings to it are then rejected.</Step>
                <Step number={3}>Year-End Close wizard rolls Revenue &amp; Expense into Retained Earnings.</Step>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* CASH & BANK */}
          <AccordionItem value="cash" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" /> Cash & Bank
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Sub icon={Landmark} title="Bank Accounts">
                <Step number={1}>Bank Accounts → Add → pick <strong>Type</strong>: Checking, Savings, or Cash/Petty Cash.</Step>
                <Step number={2}>Edit an account to set the opening balance <em>only while it is still zero</em>.</Step>
              </Sub>
              <Separator />
              <Sub icon={Banknote} title="Petty Cash">
                <p className="text-sm text-muted-foreground">Cash-type accounts get a one-click Expense button.</p>
                <Step number={1}>Open a Cash account → <strong>Record Expense</strong> → choose expense account, amount, note.</Step>
                <Step number={2}>Post → balanced JE (DR Expense / CR Cash).</Step>
              </Sub>
              <Separator />
              <Sub icon={ArrowRightLeft} title="Fund Transfers">
                <p className="text-sm text-muted-foreground">Move money between two of your bank accounts. One JE, two bank movements.</p>
              </Sub>
              <Separator />
              <Sub icon={FileText} title="Bank Statement">
                <p className="text-sm text-muted-foreground">Any bank account → <strong>Statement</strong> → running balance, filter by date, export PDF or Excel.</p>
              </Sub>
              <Separator />
              <Sub icon={CheckCircle2} title="Bank Reconciliation">
                <Step number={1}>Bank Reconciliation → pick account and statement date.</Step>
                <Step number={2}>Match system transactions to bank statement manually, via AI, or by importing CSV.</Step>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* FIXED ASSETS */}
          <AccordionItem value="assets" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" /> Fixed Assets
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <p className="text-sm text-muted-foreground">Track buildings, vehicles, equipment. System handles depreciation and disposal.</p>
              <Sub icon={FolderKanban} title="Asset Categories">
                <Step number={1}>Fixed Assets → Categories tab → define useful life, depreciation method, GL accounts (Asset, Accum Depr, Depr Expense).</Step>
              </Sub>
              <Separator />
              <Sub icon={HardDrive} title="Asset Register">
                <Step number={1}>Add Asset → tag number, category, department, acquisition date &amp; cost.</Step>
                <Step number={2}>System calculates monthly depreciation automatically.</Step>
              </Sub>
              <Separator />
              <Sub icon={Calculator} title="Monthly Depreciation">
                <Step number={1}>Depreciation tab → <strong>Run for period</strong> → JE posts: DR Depreciation Expense / CR Accumulated Depreciation.</Step>
                <Step number={2}>Net Book Value updates on the register.</Step>
              </Sub>
              <Separator />
              <Sub icon={FileText} title="Disposal">
                <Step number={1}>Asset → <strong>Dispose</strong> → enter proceeds &amp; date.</Step>
                <Step number={2}>JE recognizes Gain or Loss on Disposal and removes the asset.</Step>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* PROJECTS & BUDGETS */}
          <AccordionItem value="projects" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" /> Projects & Budgets
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Sub icon={FolderKanban} title="Projects">
                <Step number={1}>Projects → New → code, name, manager, budget, dates.</Step>
                <Step number={2}>Tag Inventory Issues and AP Invoices to the project — cost flows into <strong>Project Costs</strong>.</Step>
                <Step number={3}>Project Profitability report shows revenue vs actual cost.</Step>
              </Sub>
              <Separator />
              <Sub icon={TrendingUp} title="Budgets">
                <Step number={1}>Budgets → New → period, department, account-level amounts.</Step>
                <Step number={2}>Approving a PO creates a <strong>Commitment</strong>; posting an AP Invoice creates <strong>Consumption</strong>.</Step>
                <Step number={3}>Budget Reports show Budget vs Commitment vs Actual vs Variance.</Step>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* HR */}
          <AccordionItem value="hr" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> HR (Human Resources)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Sub icon={Building} title="Departments & Job Roles">
                <Step number={1}>Departments → Add (e.g. Finance, Ops, Sales).</Step>
                <Step number={2}>Job Roles → define role titles with default pay grade.</Step>
              </Sub>
              <Separator />
              <Sub icon={Users} title="Employees">
                <Step number={1}>Employees → Add → personal, contact, employment date, department, role, pay grade.</Step>
                <Step number={2}>Open an employee → assign current salary (creates an <em>employee salary</em> record used by payroll).</Step>
                <Step number={3}>Employees can be Active or Inactive — payroll only picks up Active.</Step>
              </Sub>
              <Separator />
              <Sub icon={Activity} title="Attendance">
                <p className="text-sm text-muted-foreground">Daily attendance log per employee — used for reports and (optionally) pay adjustments.</p>
              </Sub>
              <Separator />
              <Sub icon={Briefcase} title="Leave Management">
                <Step number={1}>Employees or Managers file leave requests in <strong>Leave Management</strong> (or via Staff Portal).</Step>
                <Step number={2}>Manager approves/rejects → balance updates.</Step>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* PAYROLL */}
          <AccordionItem value="payroll" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" /> Payroll
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Flow steps={['Pay Grades', 'Salary Components', 'Employee Salary', 'Payroll Run', 'Approve', 'Payslips', 'GL Posted']} />
              <Sub icon={DollarSign} title="Pay Grades & Salary Components">
                <Step number={1}>Pay Grades → define bands (e.g. G1–G10) with min/mid/max.</Step>
                <Step number={2}>Salary Components → define earnings (Basic, Housing, Transport) and deductions (PAYE, Pension, Loans) with formulas.</Step>
              </Sub>
              <Separator />
              <Sub icon={Users} title="Employee Salary Assignment">
                <p className="text-sm text-muted-foreground">Each active employee must have a <em>current</em> gross/net salary record before payroll runs.</p>
              </Sub>
              <Separator />
              <Sub icon={Calculator} title="Payroll Runs">
                <Step number={1}>Payroll Runs → <strong>New</strong> → pick month &amp; year → Generate.</Step>
                <Step number={2}>System auto-creates payroll lines for every active employee with a current salary — gross, deductions, net.</Step>
                <Step number={3}>Review lines in the run detail page.</Step>
                <Step number={4}><strong>Approve</strong> → JE posts (DR Salary Expense / CR Salaries Payable, PAYE Payable, Pension Payable), payslips are generated.</Step>
              </Sub>
              <Separator />
              <Sub icon={FileText} title="Payslips">
                <p className="text-sm text-muted-foreground">One payslip per employee per approved run — viewable in Payslips page and downloadable by staff via Staff Portal.</p>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* PORTALS */}
          <AccordionItem value="portals" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> Vendor & Staff Portals
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Sub icon={Store} title="Vendor Portal (/vendor-portal)">
                <p className="text-sm text-muted-foreground">Separate login for vendors.</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>Self-register (Admin approves under Vendor Registrations).</li>
                  <li>Accept purchase orders.</li>
                  <li>Submit quotes to RFQ invitations.</li>
                  <li>Drop invoices directly against POs.</li>
                </ul>
              </Sub>
              <Separator />
              <Sub icon={UserCog} title="Staff Portal (/staff-portal)">
                <p className="text-sm text-muted-foreground">Separate login for employees.</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>View and download payslips.</li>
                  <li>Submit leave requests.</li>
                  <li>Submit expense claims.</li>
                  <li>Update profile.</li>
                </ul>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* ADMIN */}
          <AccordionItem value="admin" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" /> Administration
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Sub icon={UserCog} title="Users, Roles & Permissions">
                <Step number={1}>User Management → invite users, assign roles.</Step>
                <Step number={2}>Roles map to permissions in <em>app_role_permissions</em> — control which menus each role sees.</Step>
              </Sub>
              <Separator />
              <Sub icon={CheckCircle2} title="Approval Rules & Workflows">
                <p className="text-sm text-muted-foreground">Define who approves what and at what threshold. Supports sequential and parallel approvers.</p>
              </Sub>
              <Separator />
              <Sub icon={Building2} title="Organization Setup & Branding">
                <p className="text-sm text-muted-foreground">Company name, logo, address, tax IDs, currency, signatures. Appears on printed PO/Invoice/GRN.</p>
              </Sub>
              <Separator />
              <Sub icon={FileText} title="Opening Balances / Go-Live">
                <p className="text-sm text-muted-foreground">One-time cutover wizard: Trial Balance, Open AP, Open AR, Inventory, Fixed Assets.</p>
              </Sub>
              <Separator />
              <Sub icon={Shield} title="Backups & System Health">
                <Step number={1}>Backup Management → Run backup → Verify integrity.</Step>
                <Step number={2}>System Health Check runs 20+ diagnostics — expect all green before go-live.</Step>
              </Sub>
              <Separator />
              <Sub icon={BookOpen} title="Creator's Handbook, Flow Diagrams, Trainer's Script">
                <p className="text-sm text-muted-foreground">Admin menu contains three training resources — read them before onboarding users.</p>
              </Sub>
            </AccordionContent>
          </AccordionItem>

          {/* REPORTS */}
          <AccordionItem value="reports" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Reports (where to find what)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4 text-sm text-muted-foreground">
              <p>• <strong>Trial Balance / P&amp;L / Balance Sheet / Cash Flow</strong> → Financial Reports.</p>
              <p>• <strong>AR / AP Aging</strong> → Finance AR / AP Reports.</p>
              <p>• <strong>Vendor Statement</strong> → invoices + payments + running balance per vendor.</p>
              <p>• <strong>Customer Statement</strong> → Account Statement page.</p>
              <p>• <strong>Inventory Valuation</strong> → matches Balance Sheet Inventory line.</p>
              <p>• <strong>Slow Moving / Dead Stock</strong> → Warehouse Reports.</p>
              <p>• <strong>Procurement / PO Closure / Requisition-to-Payment</strong> → Procurement Reports.</p>
              <p>• <strong>Project Profitability & Budget Variance</strong> → Projects / Budget Reports.</p>
              <p>• <strong>Bank Statement</strong> → per bank account, PDF or Excel.</p>
              <p>• <strong>Audit Report</strong> → who did what, when.</p>
            </AccordionContent>
          </AccordionItem>

          {/* TROUBLESHOOT */}
          <AccordionItem value="trouble" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" /> Troubleshooting
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-4 text-sm text-muted-foreground">
              <p><strong>"Cannot post"</strong> → Fiscal period locked, or JE not balanced.</p>
              <p><strong>"Invoice on hold"</strong> → check Match Exceptions.</p>
              <p><strong>"Inventory won't decrease"</strong> → wrong location, or reservation exists.</p>
              <p><strong>"Cannot edit / delete"</strong> → transaction is no longer in Draft.</p>
              <p><strong>"Menu missing"</strong> → your role lacks permission — see Admin.</p>
              <p><strong>"Report doesn't match GL"</strong> → check Inventory Valuation reconciliation tab, then Trial Balance.</p>
              <p><strong>Anything else</strong> → run <strong>System Health Check</strong>.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </AppLayout>
  );
}
