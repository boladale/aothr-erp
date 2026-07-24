import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { PenLine, ExternalLink, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Admin panel: configure BoldSign e-signature per organization.
 * The API key is stored server-side; this panel only reveals whether a key is
 * present, never the key itself.
 */
export function BoldSignSettingsPanel() {
  const { organizationId, isAdmin } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data } = await supabase.rpc('get_org_boldsign_settings', { _org_id: organizationId } as any);
    const row = Array.isArray(data) ? data[0] : data;
    setEnabled(!!row?.boldsign_enabled);
    setHasKey(!!row?.has_api_key);
    setLoading(false);
  };

  useEffect(() => { load(); }, [organizationId]);

  const save = async () => {
    if (!organizationId) return;
    setSaving(true);
    const { error } = await supabase.rpc('set_org_boldsign_settings', {
      _org_id: organizationId,
      _api_key: apiKey || '',
      _enabled: enabled,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setApiKey('');
    await load();
    toast.success('BoldSign settings saved');
  };

  if (!isAdmin) return null;

  const webhookUrl = `https://mbtykleryxxxlkiqopgq.supabase.co/functions/v1/boldsign-webhook`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PenLine className="h-5 w-5" /> E-Signature (BoldSign)</CardTitle>
        <CardDescription>
          Send Purchase Orders, RFQs, vendor contracts and fixed asset disposals to vendors for legally-binding electronic signatures.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <Alert>
              <AlertDescription className="text-sm space-y-1">
                <div className="font-medium">Getting started (one-time setup):</div>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Create a free BoldSign account at <a href="https://boldsign.com" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">boldsign.com <ExternalLink className="h-3 w-3" /></a> (25 free signatures/month).</li>
                  <li>In BoldSign go to <strong>API → API Keys</strong> and generate a new key. Copy it.</li>
                  <li>Paste the key below and turn the switch on.</li>
                  <li>In BoldSign <strong>Settings → Webhooks</strong> add this URL so status updates flow back:</li>
                </ol>
                <div className="mt-2 flex items-center gap-2">
                  <code className="text-xs bg-muted p-1.5 rounded flex-1 break-all">{webhookUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copied'); }}>Copy</Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-base">Enable BoldSign</Label>
                <p className="text-xs text-muted-foreground">Show the "Send for Signature" button on documents.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> BoldSign API Key
                {hasKey && <span className="text-xs text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> saved</span>}
              </Label>
              <Input
                type="password"
                placeholder={hasKey ? '••••••• (leave blank to keep existing)' : 'Paste your BoldSign API key'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Stored securely in your organization record. Only admins can view or change this setting.
              </p>
            </div>

            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
