import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Sparkles, KeyRound, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { friendlyError } from '@/lib/friendly-error';

/** Admin panel: each company saves its own OpenAI key. The key is never shown back. */
export function OpenAIKeyPanel() {
  const { isAdmin, organizationId } = useAuth();
  const [hasKey, setHasKey] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.rpc as any)('get_org_openai_settings');
    const row = Array.isArray(data) ? data[0] : data;
    setHasKey(!!row?.has_key);
    setHint(row?.key_hint ?? null);
    setLoading(false);
  };
  useEffect(() => { if (organizationId) load(); }, [organizationId]);

  const save = async (value: string) => {
    setSaving(true);
    const { error } = await (supabase.rpc as any)('set_org_openai_key', { _api_key: value });
    setSaving(false);
    if (error) { toast.error(friendlyError(error)); return; }
    setApiKey('');
    await load();
    toast.success(value ? 'OpenAI key saved' : 'OpenAI key removed');
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> AI – OpenAI Key</CardTitle>
        <CardDescription>
          Your company's own OpenAI key. All AI features (briefings, Ask Aothr) use it and OpenAI bills your company directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <>
            <Alert>
              <AlertDescription className="text-sm">
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Sign in at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">platform.openai.com <ExternalLink className="h-3 w-3" /></a> and add a payment method.</li>
                  <li>Click <strong>Create new secret key</strong> and copy it (starts with <code>sk-</code>).</li>
                  <li>Paste it below and click Save.</li>
                </ol>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> OpenAI API Key
                {hasKey && <span className="text-xs text-success inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> saved {hint}</span>}
              </Label>
              <Input type="password" placeholder={hasKey ? 'Paste a new key to replace the saved one' : 'sk-...'}
                value={apiKey} onChange={e => setApiKey(e.target.value)} />
              <p className="text-xs text-muted-foreground">Stored securely on the server. Nobody, including admins, can view it again after saving.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => save(apiKey)} disabled={saving || !apiKey.trim()}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save key
              </Button>
              {hasKey && <Button variant="outline" onClick={() => save('')} disabled={saving}>Remove key</Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
