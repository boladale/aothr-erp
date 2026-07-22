import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Save, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Setting = {
  id: string;
  event_key: string;
  event_label: string;
  module: string;
  description: string | null;
  enabled: boolean;
  extra_emails: string[];
  template_name: string;
};

export default function EmailEvents() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      setIsAdmin((data || []).some((r: any) => r.role === 'admin'));
    })();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('email_event_settings' as any)
      .select('*')
      .order('module', { ascending: true })
      .order('event_label', { ascending: true });
    setRows(((data || []) as any[]).map((r) => ({
      ...r,
      extra_emails: Array.isArray(r.extra_emails) ? r.extra_emails : [],
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const grouped = useMemo(() => {
    const m: Record<string, Setting[]> = {};
    rows.forEach((r) => {
      m[r.module] = m[r.module] || [];
      m[r.module].push(r);
    });
    return m;
  }, [rows]);

  const update = (id: string, patch: Partial<Setting>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  const saveAll = async () => {
    setSaving(true);
    const toSave = rows.filter((r) => dirty[r.id]);
    for (const r of toSave) {
      await supabase
        .from('email_event_settings' as any)
        .update({
          enabled: r.enabled,
          extra_emails: r.extra_emails,
        })
        .eq('id', r.id);
    }
    setDirty({});
    setSaving(false);
    toast.success(`Saved ${toSave.length} change(s)`);
  };

  const sendTest = async (r: Setting) => {
    if (!testEmail) {
      toast.error('Enter a test email address at the top of the page first');
      return;
    }
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: r.template_name || 'notification',
        recipientEmail: testEmail,
        idempotencyKey: `test-${r.event_key}-${Date.now()}`,
        templateData: {
          subject: `[TEST] ${r.event_label}`,
          message: `This is a test email for the "${r.event_label}" event.`,
          actionUrl: window.location.origin,
        },
      },
    });
    if (error) toast.error(`Test failed: ${error.message}`);
    else toast.success(`Test email queued to ${testEmail}`);
  };

  if (isAdmin === false) return <Navigate to="/" replace />;

  const enabledCount = rows.filter((r) => r.enabled).length;
  const dirtyCount = Object.keys(dirty).length;

  return (
    <AppLayout>
      <PageHeader
        title="Email Event Settings"
        description="Choose which business events send automatic emails"
      />

      <Card className="mb-4">
        <CardContent className="pt-6 flex flex-wrap items-center gap-3">
          <Badge variant="outline">{rows.length} events</Badge>
          <Badge variant="secondary">{enabledCount} enabled</Badge>
          {dirtyCount > 0 && <Badge>{dirtyCount} unsaved change(s)</Badge>}
          <div className="ml-auto flex items-center gap-2">
            <Input
              placeholder="Test email address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-64"
            />
            <Button onClick={saveAll} disabled={saving || dirtyCount === 0}>
              <Save className="h-4 w-4 mr-1" /> Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        Object.entries(grouped).map(([module, list]) => (
          <Card key={module} className="mb-4">
            <CardHeader>
              <CardTitle>{module}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {list.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-4 p-3 border rounded-md hover:bg-muted/30"
                >
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => update(r.id, { enabled: v })}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{r.event_label}</div>
                    {r.description && (
                      <div className="text-sm text-muted-foreground">{r.description}</div>
                    )}
                    <div className="mt-2">
                      <Input
                        placeholder="Additional recipients (comma-separated emails)"
                        value={(r.extra_emails || []).join(', ')}
                        onChange={(e) =>
                          update(r.id, {
                            extra_emails: e.target.value
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }
                        disabled={!r.enabled}
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendTest(r)}
                    disabled={!r.enabled}
                  >
                    <Send className="h-4 w-4 mr-1" /> Test
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </AppLayout>
  );
}
