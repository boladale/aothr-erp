import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  LayoutDashboard, Building2, Package, MapPin, ClipboardList, FileText,
  Boxes, DollarSign, Truck, BookOpen, Calculator, PieChart, Calendar,
  Receipt, CreditCard, Clock, AlertTriangle, Users, ArrowDownToLine,
  FileX, Landmark, ArrowRightLeft, Scale, TrendingUp, FolderKanban,
  ShoppingCart, FileCheck, Percent, Shield, Settings, Bell, BarChart3,
  FileSearch, HelpCircle, Lightbulb, ArrowRight, CheckCircle2,
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
    <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
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

export default function UserGuide() {
  return (
    <AppLayout>
      <div className="page-container space-y-8 max-w-4xl mx-auto pb-16">
        <PageHeader
          title="User Guide"
          description="Everything you need to know about using BizOps — explained simply."
        />

        {/* Quick Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              What is BizOps?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              BizOps is your all-in-one business operations system. Think of it like a <strong>super-organized notebook</strong> that keeps track of everything your company buys, sells, and owns — plus all the money coming in and going out.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center space-y-2">
                <ShoppingCart className="h-8 w-8 mx-auto text-primary" />
                <p className="text-sm font-medium">Buy Things</p>
                <p className="text-xs text-muted-foreground">Requisitions → POs → Receive → Pay</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center space-y-2">
                <FileCheck className="h-8 w-8 mx-auto text-primary" />
                <p className="text-sm font-medium">Sell Things</p>
                <p className="text-xs text-muted-foreground">Quotes → Orders → Deliver → Invoice</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center space-y-2">
                <DollarSign className="h-8 w-8 mx-auto text-primary" />
                <p className="text-sm font-medium">Track Money</p>
                <p className="text-xs text-muted-foreground">GL → Bank → Reports → Reconcile</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Getting Started (First 5 Minutes)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step number={1}>
              <strong>Sign Up:</strong> Go to the login page, click "Sign Up", fill in your name, email, and password. Check your email for a verification link.
            </Step>
            <Step number={2}>
              <strong>Sign In:</strong> After verifying your email, sign in with your email and password. You'll land on the <strong>Dashboard</strong>.
            </Step>
            <Step number={3}>
              <strong>Look at the Sidebar:</strong> On the left side, you'll see a menu with sections like Procurement, Warehouse, Finance, etc. Click any item to navigate.
            </Step>
            <Step number={4}>
              <strong>Check Your Dashboard:</strong> The Dashboard shows you a summary of what's happening — pending orders, upcoming payments, low stock alerts, and recent notifications.
            </Step>
            <Tip>
              You can collapse the sidebar by clicking the ✕ button at the top. Click the ☰ menu button to expand it again.
            </Tip>
          </CardContent>
        </Card>

        <Separator />

        {/* Module-by-Module Guide */}
        <h2 className="text-xl font-bold text-foreground">Module-by-Module Guide</h2>

        <Accordion type="multiple" className="space-y-2">
          {/* PROCUREMENT */}
          <AccordionItem value="procurement" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                🛒 Procurement (Buying Stuff)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              {/* Vendors */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Vendors
                </h4>
                <p className="text-sm text-muted-foreground">
                  Vendors are the companies or people you buy things from. Think of them as your <strong>"shopping stores."</strong>
                </p>
                <Step number={1}>Go to <strong>Vendors</strong> in the sidebar.</Step>
                <Step number={2}>Click <strong>"Add Vendor"</strong> and fill in their name, contact info, and payment terms (how many days you have to pay them).</Step>
                <Step number={3}>Save. Now this vendor is available when you create purchase orders.</Step>
                <Tip>Payment terms of "30" means you have 30 days after receiving an invoice to pay them.</Tip>
              </div>

              <Separator />

              {/* Vendor Performance */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Vendor Performance
                </h4>
                <p className="text-sm text-muted-foreground">
                  See a <strong>report card</strong> for each vendor — are they delivering on time? Is the quality good? This helps you decide who to buy from.
                </p>
              </div>

              <Separator />

              {/* RFPs */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileSearch className="h-4 w-4" /> Requests for Proposal (RFPs)
                </h4>
                <p className="text-sm text-muted-foreground">
                  When you want to buy something big, you ask multiple vendors to <strong>"give me your best price."</strong> That's an RFP!
                </p>
                <Step number={1}>Create an RFP with a title and description of what you need.</Step>
                <Step number={2}>Add the items you want and invite vendors to submit their prices.</Step>
                <Step number={3}>Compare responses and pick the best one.</Step>
              </div>

              <Separator />

              {/* Items */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" /> Items
                </h4>
                <p className="text-sm text-muted-foreground">
                  Items are all the things your company buys, sells, or keeps in the warehouse. Like a <strong>catalog of everything</strong>.
                </p>
                <Step number={1}>Go to <strong>Items</strong> and click <strong>"Add Item"</strong>.</Step>
                <Step number={2}>Give it a code (like "PEN-001"), a name, unit of measure (each, box, kg), and the price.</Step>
                <Tip>Set a "reorder level" — when stock drops below this number, you'll get a reminder to buy more.</Tip>
              </div>

              <Separator />

              {/* Locations */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Locations
                </h4>
                <p className="text-sm text-muted-foreground">
                  Locations are the <strong>places where you keep your stuff</strong> — warehouses, offices, or storage rooms.
                </p>
              </div>

              <Separator />

              {/* Requisitions */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Requisitions
                </h4>
                <p className="text-sm text-muted-foreground">
                  A requisition is like <strong>raising your hand and saying "I need to buy something!"</strong> It goes through an approval process before becoming a purchase order.
                </p>
                <Flow steps={['Create Requisition', 'Submit for Approval', 'Approved', 'Convert to PO']} />
                <Step number={1}>Click <strong>"New Requisition"</strong> and add the items you need with quantities.</Step>
                <Step number={2}>Submit it. Your manager (or whoever has approval authority) will review it.</Step>
                <Step number={3}>Once approved, you can convert it into a Purchase Order with one click!</Step>
              </div>

              <Separator />

              {/* Purchase Orders */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Purchase Orders (POs)
                </h4>
                <p className="text-sm text-muted-foreground">
                  A Purchase Order is your <strong>official "shopping list"</strong> that you send to a vendor. It says: "Please send us these items at these prices."
                </p>
                <Flow steps={['Create PO', 'Send to Vendor', 'Receive Goods', 'Receive Invoice', 'Pay']} />
                <Step number={1}>Create a PO (or convert from a requisition). Select a vendor and add items with quantities and prices.</Step>
                <Step number={2}>Approve and send it to the vendor.</Step>
                <Step number={3}>When items arrive, create a <strong>Goods Receipt</strong>. When the vendor sends a bill, create an <strong>Invoice</strong>.</Step>
                <Tip>You can attach files to POs — like signed contracts or quotes from the vendor.</Tip>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* WAREHOUSE */}
          <AccordionItem value="warehouse" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-primary" />
                📦 Warehouse (Your Stuff)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Boxes className="h-4 w-4" /> Inventory
                </h4>
                <p className="text-sm text-muted-foreground">
                  See <strong>how much of each item</strong> you have, at which location. It's like looking inside all your warehouses at once.
                </p>
                <Tip>If numbers don't look right, you can do an "inventory adjustment" to correct the count — like when you physically count items on the shelf.</Tip>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Inventory Valuation
                </h4>
                <p className="text-sm text-muted-foreground">
                  Shows the <strong>dollar value</strong> of everything in your warehouse. Uses FIFO (First In, First Out) — the oldest items are valued and used first.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Goods Receipts (GRNs)
                </h4>
                <p className="text-sm text-muted-foreground">
                  When a delivery truck arrives with items you ordered, you create a Goods Receipt to say <strong>"Yes, we got these items!"</strong>
                </p>
                <Step number={1}>Go to <strong>Goods Receipts</strong> and click <strong>"New Receipt"</strong>.</Step>
                <Step number={2}>Select the Purchase Order the delivery belongs to.</Step>
                <Step number={3}>Enter how many of each item you actually received (it might be less than ordered!).</Step>
                <Step number={4}>Post it. Your inventory numbers will automatically go up.</Step>
                <Tip>You can attach a photo of the delivery note or packing slip for your records.</Tip>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SALES */}
          <AccordionItem value="sales" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                💰 Sales (Selling Stuff)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <Flow steps={['Quotation', 'Sales Order', 'Delivery Note', 'AR Invoice', 'Receive Payment']} />

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileCheck className="h-4 w-4" /> Quotations
                </h4>
                <p className="text-sm text-muted-foreground">
                  A quotation is like telling a customer <strong>"Here's what it'll cost"</strong> before they agree to buy. If they say yes, you convert it to a Sales Order!
                </p>
                <Step number={1}>Create a quotation, select the customer, and add items with prices.</Step>
                <Step number={2}>Send it to the customer.</Step>
                <Step number={3}>If they accept, click <strong>"Convert to Sales Order"</strong>.</Step>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Sales Orders
                </h4>
                <p className="text-sm text-muted-foreground">
                  A confirmed agreement with a customer: <strong>"Yes, we will sell you these items."</strong> From here, you create delivery notes to ship items.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Delivery Notes
                </h4>
                <p className="text-sm text-muted-foreground">
                  When you physically send items to a customer, you create a Delivery Note. It's proof that <strong>"we shipped these items to you."</strong> Posting a delivery note automatically reduces your inventory.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Returns &amp; Credit Notes
                </h4>
                <p className="text-sm text-muted-foreground">
                  If a customer returns items or there's a problem, you create a <strong>Credit Note</strong> — it's like saying "We owe you money back." You can link it to the original invoice.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* GENERAL LEDGER */}
          <AccordionItem value="gl" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                📒 General Ledger (The Big Book of Money)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Chart of Accounts
                </h4>
                <p className="text-sm text-muted-foreground">
                  Think of this as a <strong>big list of piggy banks</strong>, each one labeled for a different purpose: "Cash", "Office Supplies Expense", "Sales Revenue", etc. Every dollar in your business sits in one of these accounts.
                </p>
                <Tip>Accounts are organized into types: Assets (things you own), Liabilities (things you owe), Revenue (money coming in), and Expenses (money going out).</Tip>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Journal Entries
                </h4>
                <p className="text-sm text-muted-foreground">
                  Every time money moves, you record it in a journal entry. It has at least two lines: one account gets a <strong>Debit</strong> (money in) and another gets a <strong>Credit</strong> (money out). They must always balance!
                </p>
                <Step number={1}>Click <strong>"New Entry"</strong>, add a description like "Bought office chairs".</Step>
                <Step number={2}>Add lines: Debit "Office Furniture" $500, Credit "Cash" $500.</Step>
                <Step number={3}>Post the entry. Account balances update automatically.</Step>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <PieChart className="h-4 w-4" /> Financial Reports
                </h4>
                <p className="text-sm text-muted-foreground">
                  The big picture reports: <strong>Balance Sheet</strong> (what you own vs what you owe), <strong>Income Statement</strong> (did you make or lose money?), and <strong>Trial Balance</strong> (are all accounts in balance?).
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Fiscal Periods
                </h4>
                <p className="text-sm text-muted-foreground">
                  Your financial year is divided into periods (usually months). You <strong>open</strong> a period to allow transactions, and <strong>close</strong> it when the month is done to lock the books.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* FINANCE - AP */}
          <AccordionItem value="ap" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                💳 Accounts Payable (Money You Owe)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <p className="text-sm text-muted-foreground">
                AP is about tracking <strong>bills you need to pay</strong> to vendors.
              </p>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> AP Invoices
                </h4>
                <p className="text-sm text-muted-foreground">
                  When a vendor sends you a bill, enter it here. The system does <strong>3-way matching</strong>: it checks the PO (what you ordered), the GRN (what you received), and the invoice (what they're charging) — all three should agree!
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> AP Payments
                </h4>
                <p className="text-sm text-muted-foreground">
                  When it's time to pay, create a payment and <strong>allocate</strong> it to one or more invoices. The payment method can be cheque, bank transfer, or cash.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" /> AP Aging
                </h4>
                <p className="text-sm text-muted-foreground">
                  Shows how old your unpaid bills are: current, 30 days, 60 days, 90+ days. The older a bill, the more <strong>urgently</strong> you need to pay it!
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Match Exceptions
                </h4>
                <p className="text-sm text-muted-foreground">
                  When the PO, GRN, and invoice <strong>don't match</strong> (e.g., the vendor charged more than expected), it shows up here so you can investigate.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* FINANCE - AR */}
          <AccordionItem value="ar" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-primary" />
                🤑 Accounts Receivable (Money Owed to You)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <p className="text-sm text-muted-foreground">
                AR is about tracking <strong>money customers owe you</strong>.
              </p>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Customers
                </h4>
                <p className="text-sm text-muted-foreground">
                  Add people or companies that buy from you. Set their credit limit and payment terms.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> AR Invoices
                </h4>
                <p className="text-sm text-muted-foreground">
                  Bills you send to customers saying <strong>"Please pay us $X for these items/services."</strong> Can be auto-generated from Delivery Notes!
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4" /> AR Receipts
                </h4>
                <p className="text-sm text-muted-foreground">
                  When a customer pays, record it here and allocate the payment to the right invoices.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileX className="h-4 w-4" /> Credit Notes
                </h4>
                <p className="text-sm text-muted-foreground">
                  If you need to give money back or reduce what a customer owes (wrong items, returns, etc.), use a credit note.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" /> AR Aging
                </h4>
                <p className="text-sm text-muted-foreground">
                  Shows how long customers have owed you money. Follow up on the old ones!
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* CASH MANAGEMENT */}
          <AccordionItem value="cash" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                🏦 Cash Management (Your Bank Accounts)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Landmark className="h-4 w-4" /> Bank Accounts
                </h4>
                <p className="text-sm text-muted-foreground">
                  Add all your company's bank accounts. Track the balance of each one.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" /> Fund Transfers
                </h4>
                <p className="text-sm text-muted-foreground">
                  Move money from one bank account to another — like from your main account to a payroll account.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Scale className="h-4 w-4" /> Bank Reconciliation
                </h4>
                <p className="text-sm text-muted-foreground">
                  Compare your bank statement with what's in BizOps. <strong>If they match, great!</strong> If not, find and fix the differences.
                </p>
                <Step number={1}>Enter your bank statement's ending balance and date range.</Step>
                <Step number={2}>Check off each transaction that appears on both the statement and in BizOps.</Step>
                <Step number={3}>When the difference is $0, you're reconciled!</Step>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Cash Flow Forecast
                </h4>
                <p className="text-sm text-muted-foreground">
                  Predicts how much cash you'll have in the future based on upcoming payments and expected receipts. Helps you avoid running out of money!
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* PROJECT ACCOUNTING */}
          <AccordionItem value="projects" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                📁 Project Accounting
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" /> Projects
                </h4>
                <p className="text-sm text-muted-foreground">
                  Create projects and assign costs to them. Every purchase order or invoice can be tagged to a project so you know <strong>exactly how much each project is costing</strong>.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Project Profitability
                </h4>
                <p className="text-sm text-muted-foreground">
                  See if your projects are making or losing money. Compare budgeted costs vs actual costs.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* TAX */}
          <AccordionItem value="tax" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                🧾 Tax Configuration
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <p className="text-sm text-muted-foreground">
                Set up <strong>tax groups</strong> with different rates. For example, a "Standard VAT" group might have a 15% rate, while an "Exempt" group has 0%. Each rate can be linked to a GL account so tax amounts are automatically posted to the right place.
              </p>
              <Step number={1}>Go to <strong>Tax Configuration</strong> under Administration.</Step>
              <Step number={2}>Create a Tax Group (e.g., "Standard VAT").</Step>
              <Step number={3}>Add rates within that group (e.g., "VAT 15%" at 15%, linked to account 2300).</Step>
            </AccordionContent>
          </AccordionItem>

          {/* REPORTS */}
          <AccordionItem value="reports" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                📊 Reports
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <p className="text-sm text-muted-foreground">
                Every module has reports you can view, filter, and export:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Procurement Reports:</strong> PO spending, vendor analysis, lead times</li>
                <li><strong>Warehouse Reports:</strong> Stock levels, slow-moving items, turnover</li>
                <li><strong>AP Reports:</strong> Payment history, aging summary, vendor balances</li>
                <li><strong>AR Reports:</strong> Customer balances, aging, collection rates</li>
                <li><strong>Cash Reports:</strong> Cash position, flow analysis, forecasts</li>
                <li><strong>PO Closure Report:</strong> Which POs are fully received, invoiced, and closed</li>
              </ul>
              <Tip>
                Use the <strong>Export</strong> buttons on any report to download as CSV (for Excel) or PDF (for printing). You can also use the Print View for a clean printable layout.
              </Tip>
            </AccordionContent>
          </AccordionItem>

          {/* ADMINISTRATION */}
          <AccordionItem value="admin" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                ⚙️ Administration
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" /> User Management
                </h4>
                <p className="text-sm text-muted-foreground">
                  Add users, assign them <strong>roles</strong> (like Admin, Procurement Officer, Warehouse Manager), and control which parts of the app they can see and use.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Approval Rules
                </h4>
                <p className="text-sm text-muted-foreground">
                  Set up who needs to approve what. For example: <strong>"Any purchase over $5,000 needs the Finance Manager's approval."</strong> You can create multi-step approval chains.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Notifications
                </h4>
                <p className="text-sm text-muted-foreground">
                  View all your notifications in one place. You'll get notified when something needs your attention — like a requisition waiting for approval or a payment that's overdue.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Admin Settings
                </h4>
                <p className="text-sm text-muted-foreground">
                  System-wide settings, data management, and configuration. Only accessible to Admin users.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ATTACHMENTS & EXPORTS */}
          <AccordionItem value="features" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                📎 Attachments &amp; Exports
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pb-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Attaching Files</h4>
                <p className="text-sm text-muted-foreground">
                  On most transaction detail pages (Purchase Orders, Invoices, Goods Receipts, etc.), you'll see an <strong>Attachments</strong> section at the bottom. You can:
                </p>
                <Step number={1}>Click <strong>"Upload"</strong> or drag and drop files.</Step>
                <Step number={2}>Attach PDFs, images, spreadsheets — anything up to 10MB.</Step>
                <Step number={3}>Download or delete attachments anytime.</Step>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold">Exporting Data</h4>
                <p className="text-sm text-muted-foreground">
                  Look for the export buttons on any list or report page:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li><strong>CSV:</strong> Downloads a file you can open in Excel or Google Sheets.</li>
                  <li><strong>PDF:</strong> Creates a nicely formatted document for printing or emailing.</li>
                  <li><strong>Print View:</strong> Opens a clean, printer-friendly version right in your browser.</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        {/* Common Workflows */}
        <Card>
          <CardHeader>
            <CardTitle>🔄 Common Workflows (Step-by-Step)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Buying Something (Procure to Pay)</h4>
              <Flow steps={['Requisition', 'Approval', 'Purchase Order', 'Goods Receipt', 'AP Invoice', '3-Way Match', 'Payment']} />
              <p className="text-xs text-muted-foreground">
                Someone requests items → Manager approves → PO sent to vendor → Items arrive → Vendor sends bill → System checks everything matches → You pay.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Selling Something (Order to Cash)</h4>
              <Flow steps={['Quotation', 'Sales Order', 'Delivery Note', 'AR Invoice', 'Receipt']} />
              <p className="text-xs text-muted-foreground">
                You quote a price → Customer agrees → You ship items → You send a bill → Customer pays you.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Month-End Close</h4>
              <Flow steps={['Reconcile Banks', 'Review Aging', 'Post Adjustments', 'Run Reports', 'Close Period']} />
              <p className="text-xs text-muted-foreground">
                Match your bank statements → Check overdue invoices → Make any corrections → Generate financial reports → Lock the month.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>❓ Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-1">
              <AccordionItem value="faq1">
                <AccordionTrigger className="text-sm">I can't see certain menu items. Why?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Your admin has assigned you a specific role that only shows modules you need. Ask your admin to update your permissions if you need access to more features.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq2">
                <AccordionTrigger className="text-sm">What's the difference between "Draft" and "Posted"?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <strong>Draft</strong> means you're still working on it — you can edit or delete it freely. <strong>Posted</strong> means it's final and has been recorded in the books. Posted transactions affect inventory, account balances, and reports. You usually can't delete posted items (but you can reverse them).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq3">
                <AccordionTrigger className="text-sm">What does "3-way matching" mean?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  It's a safety check! The system compares three things: (1) what you ordered (PO), (2) what you received (GRN), and (3) what the vendor charged (Invoice). If quantities or prices don't match, it creates a "Match Exception" so you can investigate.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq4">
                <AccordionTrigger className="text-sm">I forgot my password. What do I do?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  On the login page, click <strong>"Forgot your password?"</strong> Enter your email, and you'll receive a link to reset it.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq5">
                <AccordionTrigger className="text-sm">Can I undo a posted transaction?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  You can't delete posted transactions, but you can <strong>reverse</strong> them by creating a new journal entry that does the opposite. This keeps a complete audit trail.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>BizOps User Guide • Last updated March 2026</p>
          <p className="mt-1">Need more help? Contact your system administrator.</p>
        </div>
      </div>
    </AppLayout>
  );
}
