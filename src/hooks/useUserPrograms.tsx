import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook that fetches the list of program codes the current user
 * has access to, based on: user_roles → app_role_permissions → permissions.
 * Admin role always gets full access.
 */
export function useUserPrograms() {
  const { user, roles, loading: authLoading } = useAuth();
  const [programs, setPrograms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPrograms([]);
      setLoading(false);
      return;
    }

    // Admin gets everything
    if (roles.includes('admin')) {
      setPrograms(['__all__']);
      setLoading(false);
      return;
    }

    const fetchPrograms = async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_programs', {
          p_user_id: user.id,
        });
        if (error) throw error;
        setPrograms((data as string[]) || []);
      } catch (err) {
        console.error('Failed to fetch user programs:', err);
        setPrograms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrograms();
  }, [user, roles, authLoading]);

  const hasProgram = (code: string) => {
    if (programs.includes('__all__')) return true;
    return programs.includes(code);
  };

  return { programs, loading, hasProgram };
}
