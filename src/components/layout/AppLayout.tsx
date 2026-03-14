import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useOrgBranding } from '@/hooks/useOrgBranding';
import { useUserPrograms } from '@/hooks/useUserPrograms';
import { useIsMobile } from '@/hooks/use-mobile';
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { navSections, pathToProgram } from './nav-config';
import {
  Menu,
  X,
  ChevronDown,
  LogOut,
  Users,
  KeyRound,
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { hasProgram } = useUserPrograms();
  const { appName, logoUrl } = useOrgBranding();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const sidebarContent = (
    <>
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navSections.map(section => {
          const visibleItems = section.items.filter(item => canAccess(item.path));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="mb-4">
              {(isMobile || sidebarOpen) && (
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
                        title={!sidebarOpen && !isMobile ? item.label : undefined}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {(isMobile || sidebarOpen) && <span>{item.label}</span>}
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
                !sidebarOpen && !isMobile && "justify-center"
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {(isMobile || sidebarOpen) && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profile?.full_name || user?.email}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
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
    </>
  );

  // ---- MOBILE LAYOUT ----
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Mobile Top Bar */}
        <header className="flex h-14 items-center justify-between px-4 border-b border-border bg-card sticky top-0 z-40">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded object-contain" loading="lazy" />
            )}
            <span className="text-lg font-bold text-foreground truncate">{appName}</span>
          </div>
          <NotificationBell />
        </header>

        {/* Mobile Drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2 min-w-0">
                {logoUrl && (
                  <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded object-contain" loading="lazy" />
                )}
                <span className="text-lg font-bold text-sidebar-foreground truncate">{appName}</span>
              </div>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex flex-col h-[calc(100%-3.5rem)]">
              {sidebarContent}
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      </div>
    );
  }

  // ---- DESKTOP / TABLET LAYOUT ----
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
                <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain flex-shrink-0" loading="lazy" />
              )}
              <span className="text-xl font-bold text-sidebar-foreground truncate">{appName}</span>
            </div>
          )}
          {!sidebarOpen && logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain" loading="lazy" />
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

        {sidebarContent}
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
