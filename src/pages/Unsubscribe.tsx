import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = 'validating' | 'valid' | 'invalid' | 'confirming' | 'done' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<State>('validating');
  const [email, setEmail] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setErrorMsg('Missing unsubscribe token.');
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.valid === false) {
          setState('invalid');
          setErrorMsg(data.error || 'This unsubscribe link is invalid or has already been used.');
          return;
        }
        setEmail(data.email || '');
        setState('valid');
      } catch (e: any) {
        setState('error');
        setErrorMsg(e?.message || 'Could not validate this link.');
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState('confirming');
    try {
      const { error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) throw error;
      setState('done');
    } catch (e: any) {
      setState('error');
      setErrorMsg(e?.message || 'Failed to unsubscribe.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Email preferences</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {state === 'validating' && (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Validating link…</p>
            </div>
          )}
          {state === 'valid' && (
            <>
              <p className="text-sm text-muted-foreground">
                You are about to unsubscribe{email && ` `}
                {email && <strong className="text-foreground">{email}</strong>} from all
                notification emails sent by aothrerp.
              </p>
              <Button onClick={confirm} className="w-full">
                Confirm unsubscribe
              </Button>
            </>
          )}
          {state === 'confirming' && (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm text-muted-foreground">Unsubscribing…</p>
            </div>
          )}
          {state === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="font-medium">You have been unsubscribed.</p>
              <p className="text-sm text-muted-foreground">
                You will no longer receive notification emails from aothrerp.
              </p>
            </div>
          )}
          {(state === 'invalid' || state === 'error') && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="font-medium">Unable to process</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
