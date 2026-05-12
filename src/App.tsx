import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { OrgCurrencyProvider } from "./hooks/useOrgCurrency";
import { StaffPortalGuard } from "./components/guards/StaffPortalGuard";
import { VendorPortalGuard } from "./components/guards/VendorPortalGuard";

// Lazy-loaded pages — each becomes its own chunk loaded on demand
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Vendors = lazy(() => import("./pages/Vendors"));
const Items = lazy(() => import("./pages/Items"));
const Locations = lazy(() => import("./pages/Locations"));
const Inventory = lazy(() => import("./pages/Inventory"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const PurchaseOrderDetail = lazy(() => import("./pages/PurchaseOrderDetail"));
const GoodsReceipts = lazy(() => import("./pages/GoodsReceipts"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceInbox = lazy(() => import("./pages/InvoiceInbox"));
const MatchExceptions = lazy(() => import("./pages/MatchExceptions"));
const POClosureReport = lazy(() => import("./pages/POClosureReport"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Admin = lazy(() => import("./pages/Admin"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ApprovalRules = lazy(() => import("./pages/ApprovalRules"));
const Requisitions = lazy(() => import("./pages/Requisitions"));
const RequisitionDetail = lazy(() => import("./pages/RequisitionDetail"));
const RFPs = lazy(() => import("./pages/RFPs"));
const RFPDetail = lazy(() => import("./pages/RFPDetail"));
const VendorPerformance = lazy(() => import("./pages/VendorPerformance"));
const ChartOfAccounts = lazy(() => import("./pages/ChartOfAccounts"));
const JournalEntries = lazy(() => import("./pages/JournalEntries"));
const FinancialReports = lazy(() => import("./pages/FinancialReports"));
const FiscalPeriods = lazy(() => import("./pages/FiscalPeriods"));
const APPayments = lazy(() => import("./pages/APPayments"));
const APAging = lazy(() => import("./pages/APAging"));
const Customers = lazy(() => import("./pages/Customers"));
const ARInvoices = lazy(() => import("./pages/ARInvoices"));
const ARReceipts = lazy(() => import("./pages/ARReceipts"));
const ARCreditNotes = lazy(() => import("./pages/ARCreditNotes"));
const ARAging = lazy(() => import("./pages/ARAging"));
const BankAccounts = lazy(() => import("./pages/BankAccounts"));
const BankReconciliation = lazy(() => import("./pages/BankReconciliation"));
const FundTransfers = lazy(() => import("./pages/FundTransfers"));
const CashFlowForecast = lazy(() => import("./pages/CashFlowForecast"));
const InventoryValuation = lazy(() => import("./pages/InventoryValuation"));
const InventoryIssues = lazy(() => import("./pages/InventoryIssues"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ProjectProfitability = lazy(() => import("./pages/ProjectProfitability"));
const ProcurementReports = lazy(() => import("./pages/ProcurementReports"));
const WarehouseReports = lazy(() => import("./pages/WarehouseReports"));
const FinanceAPReports = lazy(() => import("./pages/FinanceAPReports"));
const FinanceARReports = lazy(() => import("./pages/FinanceARReports"));
const CashReports = lazy(() => import("./pages/CashReports"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TaxConfiguration = lazy(() => import("./pages/TaxConfiguration"));
const SalesQuotations = lazy(() => import("./pages/SalesQuotations"));
const SalesOrders = lazy(() => import("./pages/SalesOrders"));
const DeliveryNotes = lazy(() => import("./pages/DeliveryNotes"));
const UserGuide = lazy(() => import("./pages/UserGuide"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));
const ChairmanVendorDashboard = lazy(() => import("./pages/ChairmanVendorDashboard"));
const ChairmanVendorDetail = lazy(() => import("./pages/ChairmanVendorDetail"));
const ChairmanList = lazy(() => import("./pages/ChairmanList"));
const ProcurementDashboardPage = lazy(() => import("./pages/ProcurementDashboardPage"));
const WarehouseDashboardPage = lazy(() => import("./pages/WarehouseDashboardPage"));
const FinanceDashboardPage = lazy(() => import("./pages/FinanceDashboardPage"));
const SalesDashboardPage = lazy(() => import("./pages/SalesDashboardPage"));
const CashDashboardPage = lazy(() => import("./pages/CashDashboardPage"));
const OrganizationSetup = lazy(() => import("./pages/OrganizationSetup"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuditReport = lazy(() => import("./pages/AuditReport"));
const AccountStatement = lazy(() => import("./pages/AccountStatement"));
const Workflows = lazy(() => import("./pages/Workflows"));
const RecurringEntries = lazy(() => import("./pages/RecurringEntries"));
const InventoryTransfers = lazy(() => import("./pages/InventoryTransfers"));
const VendorPaymentReport = lazy(() => import("./pages/VendorPaymentReport"));
const RequisitionToPaymentReport = lazy(() => import("./pages/RequisitionToPaymentReport"));
const ProcurementAudit = lazy(() => import("./pages/ProcurementAudit"));
const Departments = lazy(() => import("./pages/Departments"));
const JobRoles = lazy(() => import("./pages/JobRoles"));
const Services = lazy(() => import("./pages/Services"));
const Employees = lazy(() => import("./pages/Employees"));
const EmployeeDetail = lazy(() => import("./pages/EmployeeDetail"));
const LeaveManagement = lazy(() => import("./pages/LeaveManagement"));
const Attendance = lazy(() => import("./pages/Attendance"));
const SalaryComponents = lazy(() => import("./pages/SalaryComponents"));
const PayGrades = lazy(() => import("./pages/PayGrades"));
const PayrollRuns = lazy(() => import("./pages/PayrollRuns"));
const PayrollRunDetail = lazy(() => import("./pages/PayrollRunDetail"));
const Payslips = lazy(() => import("./pages/Payslips"));
const SelfServiceDashboard = lazy(() => import("./pages/SelfServiceDashboard"));
const SelfServiceLeave = lazy(() => import("./pages/SelfServiceLeave"));
const SelfServiceExpenses = lazy(() => import("./pages/SelfServiceExpenses"));
const SelfServicePayslips = lazy(() => import("./pages/SelfServicePayslips"));
const SelfServiceProfile = lazy(() => import("./pages/SelfServiceProfile"));
const VendorPortal = lazy(() => import("./pages/VendorPortal"));
const VendorRegistrations = lazy(() => import("./pages/VendorRegistrations"));
const StaffPortalLogin = lazy(() => import("./pages/StaffPortalLogin"));
const VendorPortalLogin = lazy(() => import("./pages/VendorPortalLogin"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function OrgSetupRoute() {
  const { user, loading, organizationId } = useAuth();
  
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (organizationId) {
    return <Navigate to="/" replace />;
  }
  return <OrganizationSetup />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, organizationId, roles, signOut } = useAuth();
  
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!organizationId) {
    if (roles.length === 0) {
      return <Navigate to="/org-setup" replace />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Account Pending</h2>
          <p className="text-muted-foreground">
            Your account has not been assigned to an organization yet. Please contact your administrator to complete setup.
          </p>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OrgCurrencyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/org-setup" element={<OrgSetupRoute />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/vendor-dashboard" element={<ProtectedRoute><VendorDashboard /></ProtectedRoute>} />
            <Route path="/chairman-dashboard" element={<ProtectedRoute><ChairmanVendorDashboard /></ProtectedRoute>} />
            <Route path="/chairman-dashboard/list/:type" element={<ProtectedRoute><ChairmanList /></ProtectedRoute>} />
            <Route path="/chairman-dashboard/vendor/:id" element={<ProtectedRoute><ChairmanVendorDetail /></ProtectedRoute>} />
            <Route path="/procurement-dashboard" element={<ProtectedRoute><ProcurementDashboardPage /></ProtectedRoute>} />
            <Route path="/warehouse-dashboard" element={<ProtectedRoute><WarehouseDashboardPage /></ProtectedRoute>} />
            <Route path="/finance-dashboard" element={<ProtectedRoute><FinanceDashboardPage /></ProtectedRoute>} />
            <Route path="/sales-dashboard" element={<ProtectedRoute><SalesDashboardPage /></ProtectedRoute>} />
            <Route path="/cash-dashboard" element={<ProtectedRoute><CashDashboardPage /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
            <Route path="/items" element={<ProtectedRoute><Items /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
            <Route path="/requisitions" element={<ProtectedRoute><Requisitions /></ProtectedRoute>} />
            <Route path="/requisitions/:id" element={<ProtectedRoute><RequisitionDetail /></ProtectedRoute>} />
            <Route path="/purchase-orders/:id" element={<ProtectedRoute><PurchaseOrderDetail /></ProtectedRoute>} />
            <Route path="/goods-receipts" element={<ProtectedRoute><GoodsReceipts /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/invoice-inbox" element={<ProtectedRoute><InvoiceInbox /></ProtectedRoute>} />
            <Route path="/match-exceptions" element={<ProtectedRoute><MatchExceptions /></ProtectedRoute>} />
            <Route path="/po-closure" element={<ProtectedRoute><POClosureReport /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/approval-rules" element={<ProtectedRoute><ApprovalRules /></ProtectedRoute>} />
            <Route path="/rfps" element={<ProtectedRoute><RFPs /></ProtectedRoute>} />
            <Route path="/rfps/:id" element={<ProtectedRoute><RFPDetail /></ProtectedRoute>} />
            <Route path="/vendor-performance" element={<ProtectedRoute><VendorPerformance /></ProtectedRoute>} />
            <Route path="/chart-of-accounts" element={<ProtectedRoute><ChartOfAccounts /></ProtectedRoute>} />
            <Route path="/journal-entries" element={<ProtectedRoute><JournalEntries /></ProtectedRoute>} />
            <Route path="/financial-reports" element={<ProtectedRoute><FinancialReports /></ProtectedRoute>} />
            <Route path="/fiscal-periods" element={<ProtectedRoute><FiscalPeriods /></ProtectedRoute>} />
            <Route path="/ap-payments" element={<ProtectedRoute><APPayments /></ProtectedRoute>} />
            <Route path="/ap-aging" element={<ProtectedRoute><APAging /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/ar-invoices" element={<ProtectedRoute><ARInvoices /></ProtectedRoute>} />
            <Route path="/ar-receipts" element={<ProtectedRoute><ARReceipts /></ProtectedRoute>} />
            <Route path="/ar-credit-notes" element={<ProtectedRoute><ARCreditNotes /></ProtectedRoute>} />
            <Route path="/ar-aging" element={<ProtectedRoute><ARAging /></ProtectedRoute>} />
            <Route path="/bank-accounts" element={<ProtectedRoute><BankAccounts /></ProtectedRoute>} />
            <Route path="/bank-reconciliation" element={<ProtectedRoute><BankReconciliation /></ProtectedRoute>} />
            <Route path="/fund-transfers" element={<ProtectedRoute><FundTransfers /></ProtectedRoute>} />
            <Route path="/cash-flow-forecast" element={<ProtectedRoute><CashFlowForecast /></ProtectedRoute>} />
            <Route path="/inventory-valuation" element={<ProtectedRoute><InventoryValuation /></ProtectedRoute>} />
            <Route path="/inventory-issues" element={<ProtectedRoute><InventoryIssues /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
            <Route path="/project-profitability" element={<ProtectedRoute><ProjectProfitability /></ProtectedRoute>} />
            <Route path="/procurement-reports" element={<ProtectedRoute><ProcurementReports /></ProtectedRoute>} />
            <Route path="/warehouse-reports" element={<ProtectedRoute><WarehouseReports /></ProtectedRoute>} />
            <Route path="/ap-reports" element={<ProtectedRoute><FinanceAPReports /></ProtectedRoute>} />
            <Route path="/ar-reports" element={<ProtectedRoute><FinanceARReports /></ProtectedRoute>} />
            <Route path="/cash-reports" element={<ProtectedRoute><CashReports /></ProtectedRoute>} />
            <Route path="/tax-configuration" element={<ProtectedRoute><TaxConfiguration /></ProtectedRoute>} />
            <Route path="/sales-quotations" element={<ProtectedRoute><SalesQuotations /></ProtectedRoute>} />
            <Route path="/sales-orders" element={<ProtectedRoute><SalesOrders /></ProtectedRoute>} />
            <Route path="/delivery-notes" element={<ProtectedRoute><DeliveryNotes /></ProtectedRoute>} />
            <Route path="/user-guide" element={<ProtectedRoute><UserGuide /></ProtectedRoute>} />
            <Route path="/audit-report" element={<ProtectedRoute><AuditReport /></ProtectedRoute>} />
            <Route path="/account-statement" element={<ProtectedRoute><AccountStatement /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
            <Route path="/recurring-entries" element={<ProtectedRoute><RecurringEntries /></ProtectedRoute>} />
            <Route path="/inventory-transfers" element={<ProtectedRoute><InventoryTransfers /></ProtectedRoute>} />
            <Route path="/vendor-payment-report" element={<ProtectedRoute><VendorPaymentReport /></ProtectedRoute>} />
            <Route path="/req-to-payment-report" element={<ProtectedRoute><RequisitionToPaymentReport /></ProtectedRoute>} />
            <Route path="/procurement-audit" element={<ProtectedRoute><ProcurementAudit /></ProtectedRoute>} />
            <Route path="/vendor-registrations" element={<ProtectedRoute><VendorRegistrations /></ProtectedRoute>} />
            <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
            <Route path="/job-roles" element={<ProtectedRoute><JobRoles /></ProtectedRoute>} />
            <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
            <Route path="/leave-management" element={<ProtectedRoute><LeaveManagement /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/salary-components" element={<ProtectedRoute><SalaryComponents /></ProtectedRoute>} />
            <Route path="/pay-grades" element={<ProtectedRoute><PayGrades /></ProtectedRoute>} />
            <Route path="/payroll-runs" element={<ProtectedRoute><PayrollRuns /></ProtectedRoute>} />
            <Route path="/payroll-runs/:id" element={<ProtectedRoute><PayrollRunDetail /></ProtectedRoute>} />
            <Route path="/payslips" element={<ProtectedRoute><Payslips /></ProtectedRoute>} />
            <Route path="/self-service" element={<ProtectedRoute><SelfServiceDashboard /></ProtectedRoute>} />
            <Route path="/self-service/leave" element={<ProtectedRoute><SelfServiceLeave /></ProtectedRoute>} />
            <Route path="/self-service/expenses" element={<ProtectedRoute><SelfServiceExpenses /></ProtectedRoute>} />
            <Route path="/self-service/payslips" element={<ProtectedRoute><SelfServicePayslips /></ProtectedRoute>} />
            <Route path="/self-service/profile" element={<ProtectedRoute><SelfServiceProfile /></ProtectedRoute>} />

            {/* Staff Portal - separate login */}
            <Route path="/staff-portal/login" element={<StaffPortalLogin />} />
            <Route path="/staff-portal" element={<StaffPortalGuard><SelfServiceDashboard /></StaffPortalGuard>} />
            <Route path="/staff-portal/leave" element={<StaffPortalGuard><SelfServiceLeave /></StaffPortalGuard>} />
            <Route path="/staff-portal/expenses" element={<StaffPortalGuard><SelfServiceExpenses /></StaffPortalGuard>} />
            <Route path="/staff-portal/payslips" element={<StaffPortalGuard><SelfServicePayslips /></StaffPortalGuard>} />
            <Route path="/staff-portal/profile" element={<StaffPortalGuard><SelfServiceProfile /></StaffPortalGuard>} />

            {/* Vendor Portal - separate login with self-registration */}
            <Route path="/vendor-portal/login" element={<VendorPortalLogin />} />
            <Route path="/vendor-portal" element={<VendorPortalGuard><VendorPortal /></VendorPortalGuard>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </OrgCurrencyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
