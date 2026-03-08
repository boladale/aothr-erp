import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
