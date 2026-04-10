import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function StaffPortalGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, roles } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <Navigate to="/staff-portal/login" replace />;
  }

  if (!roles.includes('employee' as any)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">Your account does not have staff portal access. Please contact your HR administrator.</p>
          <a href="/staff-portal/login" className="text-sm text-primary underline">Back to Login</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
