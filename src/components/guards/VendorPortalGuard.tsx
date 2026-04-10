import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function VendorPortalGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, roles } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <Navigate to="/vendor-portal/login" replace />;
  }

  if (!roles.includes('vendor_user' as any)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">Your account is not linked to a vendor record, or your registration is still pending approval.</p>
          <a href="/vendor-portal/login" className="text-sm text-primary underline">Back to Login</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
