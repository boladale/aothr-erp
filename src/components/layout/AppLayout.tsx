import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Package, 
  MapPin, 
  Boxes,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
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
import { Bell } from 'lucide-react';

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
      { path: '/goods-receipts', label: 'Goods Receipts', icon: Truck },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
      { path: '/journal-entries', label: 'Journal Entries', icon: Calculator },
      { path: '/financial-reports', label: 'Financial Reports', icon: PieChart },
      { path: '/fiscal-periods', label: 'Fiscal Periods', icon: Calendar },
      { path: '/invoices', label: 'Invoices', icon: Receipt },
      { path: '/ap-payments', label: 'AP Payments', icon: CreditCard },
      { path: '/ap-aging', label: 'AP Aging', icon: Clock },
      { path: '/match-exceptions', label: 'Match Exceptions', icon: AlertTriangle },
    ],
  },
  {
    label: 'Reports',
    items: [
      { path: '/po-closure', label: 'PO Closure Report', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/notifications', label: 'Notifications', icon: Bell },
      { path: '/approval-rules', label: 'Approval Rules', icon: Shield },
      { path: '/user-management', label: 'User Management', icon: Shield },
      { path: '/admin', label: 'Admin', icon: Settings },
    ],
  },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

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
            <span className="text-xl font-bold text-sidebar-foreground">BizOps</span>
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
          {navSections.map(section => (
            <div key={section.label} className="mb-4">
              {sidebarOpen && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map(item => {
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
          ))}
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
    </div>
  );
}
