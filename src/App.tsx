import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { OrgCurrencyProvider } from "./hooks/useOrgCurrency";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Vendors from "./pages/Vendors";
import Items from "./pages/Items";
import Locations from "./pages/Locations";
import Inventory from "./pages/Inventory";
import PurchaseOrders from "./pages/PurchaseOrders";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import GoodsReceipts from "./pages/GoodsReceipts";
import Invoices from "./pages/Invoices";
import MatchExceptions from "./pages/MatchExceptions";
import POClosureReport from "./pages/POClosureReport";
import Notifications from "./pages/Notifications";
import Admin from "./pages/Admin";
import UserManagement from "./pages/UserManagement";
import ApprovalRules from "./pages/ApprovalRules";
import Requisitions from "./pages/Requisitions";
import RequisitionDetail from "./pages/RequisitionDetail";
import RFPs from "./pages/RFPs";
import RFPDetail from "./pages/RFPDetail";
import VendorPerformance from "./pages/VendorPerformance";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import JournalEntries from "./pages/JournalEntries";
import FinancialReports from "./pages/FinancialReports";
import FiscalPeriods from "./pages/FiscalPeriods";
import APPayments from "./pages/APPayments";
import APAging from "./pages/APAging";
import Customers from "./pages/Customers";
import ARInvoices from "./pages/ARInvoices";
import ARReceipts from "./pages/ARReceipts";
import ARCreditNotes from "./pages/ARCreditNotes";
import ARAging from "./pages/ARAging";
import BankAccounts from "./pages/BankAccounts";
import BankReconciliation from "./pages/BankReconciliation";
import FundTransfers from "./pages/FundTransfers";
import CashFlowForecast from "./pages/CashFlowForecast";
import InventoryValuation from "./pages/InventoryValuation";
import InventoryIssues from "./pages/InventoryIssues";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectProfitability from "./pages/ProjectProfitability";
import ProcurementReports from "./pages/ProcurementReports";
import WarehouseReports from "./pages/WarehouseReports";
import FinanceAPReports from "./pages/FinanceAPReports";
import FinanceARReports from "./pages/FinanceARReports";
import CashReports from "./pages/CashReports";
import ResetPassword from "./pages/ResetPassword";
import TaxConfiguration from "./pages/TaxConfiguration";
import SalesQuotations from "./pages/SalesQuotations";
import SalesOrders from "./pages/SalesOrders";
import DeliveryNotes from "./pages/DeliveryNotes";
import UserGuide from "./pages/UserGuide";
import UserProfile from "./pages/UserProfile";
import VendorDashboard from "./pages/VendorDashboard";
import ChairmanVendorDashboard from "./pages/ChairmanVendorDashboard";
import ChairmanVendorDetail from "./pages/ChairmanVendorDetail";
import ChairmanList from "./pages/ChairmanList";
import ProcurementDashboardPage from "./pages/ProcurementDashboardPage";
import WarehouseDashboardPage from "./pages/WarehouseDashboardPage";
import FinanceDashboardPage from "./pages/FinanceDashboardPage";
import SalesDashboardPage from "./pages/SalesDashboardPage";
import CashDashboardPage from "./pages/CashDashboardPage";
import OrganizationSetup from "./pages/OrganizationSetup";
import NotFound from "./pages/NotFound";
import AuditReport from "./pages/AuditReport";
import AccountStatement from "./pages/AccountStatement";
import Workflows from "./pages/Workflows";
import RecurringEntries from "./pages/RecurringEntries";
import InventoryTransfers from "./pages/InventoryTransfers";
import VendorPaymentReport from "./pages/VendorPaymentReport";
import RequisitionToPaymentReport from "./pages/RequisitionToPaymentReport";
import ProcurementAudit from "./pages/ProcurementAudit";
import Departments from "./pages/Departments";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail";
import LeaveManagement from "./pages/LeaveManagement";
import Attendance from "./pages/Attendance";
import SalaryComponents from "./pages/SalaryComponents";
import PayGrades from "./pages/PayGrades";
import PayrollRuns from "./pages/PayrollRuns";
import PayrollRunDetail from "./pages/PayrollRunDetail";
import Payslips from "./pages/Payslips";
import SelfServiceDashboard from "./pages/SelfServiceDashboard";
import SelfServiceLeave from "./pages/SelfServiceLeave";
import SelfServiceExpenses from "./pages/SelfServiceExpenses";
import SelfServicePayslips from "./pages/SelfServicePayslips";
import SelfServiceProfile from "./pages/SelfServiceProfile";
import VendorPortal from "./pages/VendorPortal";
import VendorRegistrations from "./pages/VendorRegistrations";
import StaffPortalLogin from "./pages/StaffPortalLogin";
import VendorPortalLogin from "./pages/VendorPortalLogin";
import { StaffPortalGuard } from "./components/guards/StaffPortalGuard";
import { VendorPortalGuard } from "./components/guards/VendorPortalGuard";

const queryClient = new QueryClient();

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
    // Self-registered user (no roles) → let them create an org
    // Admin-created user (has roles but no org) → show pending message
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
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/org-setup" element={<OrgSetupRoute />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/vendor-dashboard" element={<ProtectedRoute><VendorDashboard /></ProtectedRoute>} />
            <Route path="/chairman-dashboard" element={<ProtectedRoute><ChairmanVendorDashboard /></ProtectedRoute>} />
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
        </BrowserRouter>
      </TooltipProvider>
      </OrgCurrencyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
