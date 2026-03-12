import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Package, 
  MapPin, 
  Boxes,
  DollarSign,
  FileText,
  Truck,
  Receipt,
  ClipboardCheck,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown,
  AlertTriangle,
  FileSearch,
  BarChart3,
  BookOpen,
  Calculator,
  PieChart,
  Calendar,
  CreditCard,
  Clock,
  Users,
  ArrowDownToLine,
  FileX,
  Landmark,
  ArrowRightLeft,
  TrendingUp,
  Scale,
  FolderKanban,
  ShoppingCart,
  FileCheck,
  Percent,
  BookOpenCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useOrgBranding } from '@/hooks/useOrgBranding';
import { useUserPrograms } from '@/hooks/useUserPrograms';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ChangePasswordDialog } from '@/components/admin/ChangePasswordDialog';
import { Bell, KeyRound } from 'lucide-react';

// Map each nav path to a program code in the permissions table
const pathToProgram: Record<string, string> = {
  '/': 'dashboard',
  '/vendor-dashboard': 'vendor_dashboard',
  '/procurement-dashboard': 'procurement_dashboard',
  '/warehouse-dashboard': 'warehouse_dashboard',
  '/finance-dashboard': 'finance_dashboard',
  '/sales-dashboard': 'sales_dashboard',
  '/cash-dashboard': 'cash_dashboard',
  '/vendors': 'vendors',
  '/vendor-performance': 'vendor_performance',
  '/rfps': 'rfps',
  '/items': 'items',
  '/locations': 'locations',
  '/requisitions': 'requisitions',
  '/purchase-orders': 'purchase_orders',
  '/inventory': 'inventory',
  '/inventory-valuation': 'inventory_valuation',
  '/inventory-issues': 'inventory_issues',
  '/goods-receipts': 'goods_receipts',
  '/chart-of-accounts': 'chart_of_accounts',
  '/journal-entries': 'journal_entries',
  '/financial-reports': 'financial_reports',
  '/fiscal-periods': 'fiscal_periods',
  '/invoices': 'invoices',
  '/ap-payments': 'ap_payments',
  '/ap-aging': 'ap_aging',
  '/match-exceptions': 'match_exceptions',
  '/customers': 'customers',
  '/ar-invoices': 'ar_invoices',
  '/ar-receipts': 'ar_receipts',
  '/ar-credit-notes': 'ar_credit_notes',
  '/ar-aging': 'ar_aging',
  '/bank-accounts': 'bank_accounts',
  '/fund-transfers': 'fund_transfers',
  '/bank-reconciliation': 'bank_reconciliation',
  '/cash-flow-forecast': 'cash_flow_forecast',
  '/projects': 'projects',
  '/project-profitability': 'project_profitability',
  '/po-closure': 'po_closure',
  '/procurement-reports': 'procurement_reports',
  '/warehouse-reports': 'warehouse_reports',
  '/ap-reports': 'ap_reports',
  '/ar-reports': 'ar_reports',
  '/cash-reports': 'cash_reports',
  '/tax-configuration': 'tax_configuration',
  '/sales-quotations': 'sales_quotations',
  '/sales-orders': 'sales_orders',
  '/delivery-notes': 'delivery_notes',
  '/notifications': 'notifications',
  '/approval-rules': 'approval_rules',
  '/user-management': 'user_management',
  '/admin': 'admin',
};

interface AppLayoutProps {
  children: ReactNode;
}

const navSections = [
  {
    label: 'Main',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Dashboards',
    items: [
      { path: '/vendor-dashboard', label: 'Vendor Mgmt', icon: Building2 },
      { path: '/procurement-dashboard', label: 'Procurement', icon: FileText },
      { path: '/warehouse-dashboard', label: 'Warehouse', icon: Boxes },
      { path: '/finance-dashboard', label: 'Finance', icon: Calculator },
      { path: '/sales-dashboard', label: 'Sales', icon: ShoppingCart },
      { path: '/cash-dashboard', label: 'Cash Mgmt', icon: Landmark },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { path: '/vendors', label: 'Vendors', icon: Building2 },
      { path: '/vendor-performance', label: 'Vendor Performance', icon: BarChart3 },
      { path: '/rfps', label: 'Requests for Proposal', icon: FileSearch },
      { path: '/items', label: 'Items', icon: Package },
      { path: '/locations', label: 'Locations', icon: MapPin },
      { path: '/requisitions', label: 'Requisitions', icon: ClipboardList },
      { path: '/purchase-orders', label: 'Purchase Orders', icon: FileText },
    ],
  },
  {
    label: 'Warehouse',
    items: [
      { path: '/inventory', label: 'Inventory', icon: Boxes },
      { path: '/inventory-valuation', label: 'Inventory Valuation', icon: DollarSign },
      { path: '/inventory-issues', label: 'Inventory Issues', icon: PackageMinus },
      { path: '/goods-receipts', label: 'Goods Receipts', icon: Truck },
    ],
  },
  {
    label: 'General Ledger',
    items: [
      { path: '/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
      { path: '/journal-entries', label: 'Journal Entries', icon: Calculator },
      { path: '/financial-reports', label: 'Financial Reports', icon: PieChart },
      { path: '/fiscal-periods', label: 'Fiscal Periods', icon: Calendar },
    ],
  },
  {
    label: 'Finance - AP',
    items: [
      { path: '/invoices', label: 'AP Invoices', icon: Receipt },
      { path: '/ap-payments', label: 'AP Payments', icon: CreditCard },
      { path: '/ap-aging', label: 'AP Aging', icon: Clock },
      { path: '/match-exceptions', label: 'Match Exceptions', icon: AlertTriangle },
    ],
  },
  {
    label: 'Finance - AR',
    items: [
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/ar-invoices', label: 'AR Invoices', icon: Receipt },
      { path: '/ar-receipts', label: 'AR Receipts', icon: ArrowDownToLine },
      { path: '/ar-credit-notes', label: 'Credit Notes', icon: FileX },
      { path: '/ar-aging', label: 'AR Aging', icon: Clock },
    ],
  },
  {
    label: 'Sales',
    items: [
      { path: '/sales-quotations', label: 'Quotations', icon: FileCheck },
      { path: '/sales-orders', label: 'Sales Orders', icon: ShoppingCart },
      { path: '/delivery-notes', label: 'Delivery Notes', icon: Truck },
    ],
  },
  {
    label: 'Cash Management',
    items: [
      { path: '/bank-accounts', label: 'Bank Accounts', icon: Landmark },
      { path: '/fund-transfers', label: 'Fund Transfers', icon: ArrowRightLeft },
      { path: '/bank-reconciliation', label: 'Reconciliation', icon: Scale },
      { path: '/cash-flow-forecast', label: 'Cash Forecast', icon: TrendingUp },
    ],
  },
  {
    label: 'Project Accounting',
    items: [
      { path: '/projects', label: 'Projects', icon: FolderKanban },
      { path: '/project-profitability', label: 'Profitability', icon: TrendingUp },
    ],
  },
  {
    label: 'Reports',
    items: [
      { path: '/procurement-reports', label: 'Procurement Reports', icon: BarChart3 },
      { path: '/warehouse-reports', label: 'Warehouse Reports', icon: BarChart3 },
      { path: '/ap-reports', label: 'AP Reports', icon: BarChart3 },
      { path: '/ar-reports', label: 'AR Reports', icon: BarChart3 },
      { path: '/cash-reports', label: 'Cash Reports', icon: BarChart3 },
      { path: '/po-closure', label: 'PO Closure Report', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/tax-configuration', label: 'Tax Configuration', icon: Percent },
      { path: '/notifications', label: 'Notifications', icon: Bell },
      { path: '/approval-rules', label: 'Approval Rules', icon: Shield },
      { path: '/user-management', label: 'User Management', icon: Shield },
      { path: '/admin', label: 'Admin', icon: Settings },
      { path: '/user-guide', label: 'User Guide', icon: BookOpenCheck },
    ],
  },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { hasProgram } = useUserPrograms();
  const { appName, logoUrl } = useOrgBranding();

  const canAccess = (path: string) => {
    const programCode = pathToProgram[path];
    if (!programCode) return true;
    return hasProgram(programCode);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U';

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen && (
            <div className="flex items-center gap-2 min-w-0">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain flex-shrink-0" />
              )}
              <span className="text-xl font-bold text-sidebar-foreground truncate">{appName}</span>
            </div>
          )}
          {!sidebarOpen && logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain" />
          )}
          <div className="flex items-center gap-1">
            {sidebarOpen && <NotificationBell />}
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navSections.map(section => {
            const visibleItems = section.items.filter(item => canAccess(item.path));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label} className="mb-4">
                {sidebarOpen && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                    {section.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={cn("nav-item", isActive && "nav-item-active")}
                          title={!sidebarOpen ? item.label : undefined}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {sidebarOpen && <span>{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="border-t border-sidebar-border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent",
                  !sidebarOpen && "justify-center"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium truncate">
                        {profile?.full_name || user?.email}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <Users className="h-4 w-4 mr-2" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                <KeyRound className="h-4 w-4 mr-2" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-y-auto transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-16"
      )}>
        {children}
      </main>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
