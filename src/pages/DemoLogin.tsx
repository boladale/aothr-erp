import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const DEMO_EMAIL = 'demo@aothr.com';

export async function startDemo(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('demo-login', { body: {} });
  if (error || !data?.access_token) return data?.error || 'The demo is not available right now. Please try again shortly.';
  const { error: sErr } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  return sErr ? 'The demo is not available right now. Please try again shortly.' : null;
}

// Public link for the website: /demo signs the visitor in and opens Ask Aothr.
export default function DemoLogin() {
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    startDemo().then((e) => (e ? setErr(e) : navigate('/ask-aothr', { replace: true })));
  }, [navigate]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4 text-center">
      <Sparkles className="h-10 w-10 text-primary" />
      {err ? <p className="text-muted-foreground">{err}</p> : (
        <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Opening the Ask Aothr demo…</p>
      )}
    </div>
  );
}
