import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Power } from 'lucide-react';
import { friendlyError } from '@/lib/friendly-error';

type Key = 'ai_enabled' | 'chat_enabled' | 'morning_brief_enabled';
const ROWS: { key: Key; label: string; help: string }[] = [
  { key: 'ai_enabled', label: 'AI for this company', help: 'Master switch. When off, all AI features stop for everyone.' },
  { key: 'morning_brief_enabled', label: 'My Briefing AI summary', help: 'The short written summary at the top of My Briefing.' },
  { key: 'chat_enabled', label: 'Ask Aothr chat', help: 'Staff can ask questions about the business.' },
];

/** Admin-only on/off switches for the company's AI features. */
export function AISettingsPanel() {
  const { isAdmin, organizationId, user } = useAuth();
  const [s, setS] = useState<Record<Key, boolean>>({ ai_enabled: true, chat_enabled: true, morning_brief_enabled: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const { data } = await supabase.from('ai_settings').select('ai_enabled, chat_enabled, morning_brief_enabled').eq('organization_id', organizationId).maybeSingle();
      if (data) setS(data as any);
      setLoading(false);
    })();
  }, [organizationId]);

  const toggle = async (key: Key, value: boolean) => {
    const prev = s;
    setS({ ...s, [key]: value });
    const { error } = await supabase.from('ai_settings').upsert(
      { organization_id: organizationId!, [key]: value, updated_by: user?.id, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' },
    );
    if (error) { setS(prev); toast.error(friendlyError(error)); return; }
    toast.success(value ? 'Switched on' : 'Switched off');
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Power className="h-5 w-5" /> AI – On / Off</CardTitle>
        <CardDescription>Choose which AI features your company uses.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : ROWS.map((r) => {
          const disabled = r.key !== 'ai_enabled' && !s.ai_enabled;
          return (
            <div key={r.key} className="flex items-start justify-between gap-4 border-b last:border-0 pb-3 last:pb-0">
              <div>
                <Label htmlFor={r.key} className="font-medium">{r.label}</Label>
                <p className="text-xs text-muted-foreground">{r.help}</p>
              </div>
              <Switch id={r.key} checked={s[r.key] && !disabled} disabled={disabled} onCheckedChange={(v) => toggle(r.key, v)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
