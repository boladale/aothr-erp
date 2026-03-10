import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface OrgBranding {
  appName: string;
  logoUrl: string | null;
  loading: boolean;
}

export function useOrgBranding(): OrgBranding {
  const { organizationId } = useAuth();
  const [appName, setAppName] = useState('BizOps');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const fetchBranding = async () => {
      const { data } = await supabase
        .from('organizations')
        .select('app_name, logo_url')
        .eq('id', organizationId)
        .single();

      if (data) {
        setAppName((data as any).app_name || 'BizOps');
        setLogoUrl(data.logo_url || null);
      }
      setLoading(false);
    };

    fetchBranding();

    // Subscribe to changes
    const channel = supabase
      .channel('org-branding')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'organizations',
        filter: `id=eq.${organizationId}`,
      }, (payload) => {
        const newData = payload.new as any;
        setAppName(newData.app_name || 'BizOps');
        setLogoUrl(newData.logo_url || null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organizationId]);

  return { appName, logoUrl, loading };
}
