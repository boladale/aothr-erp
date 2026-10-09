import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { mfaTools } from "@/lib/mfa";

type Person = { user_id: string; full_name: string | null; email: string | null; is_active: boolean | null; has_authenticator: boolean };

export function SecuritySettingsPanel() {
  const { organizationId, user } = useAuth();
  const [mfa, setMfa] = useState(false);
  const [days, setDays] = useState("90");
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);

  const loadPeople = async () => {
    const r = await mfaTools<{ users: Person[] }>({ action: "admin_list" });
    setPeople(r.users ?? []);
  };

  useEffect(() => {
    if (!organizationId) return;
    (supabase.from("org_security_settings" as any).select("*").eq("organization_id", organizationId).maybeSingle() as any)
      .then(({ data }: any) => { if (data) { setMfa(data.mfa_required); setDays(String(data.password_max_age_days)); } });
    loadPeople();
  }, [organizationId]);

  const save = async (next: { mfa?: boolean; days?: string }) => {
    const m = next.mfa ?? mfa; const d = next.days ?? days;
    setMfa(m); setDays(d); setSaving(true);
    const { error } = await (supabase.from("org_security_settings" as any) as any).upsert({
      organization_id: organizationId, mfa_required: m, password_max_age_days: Number(d), updated_at: new Date().toISOString(), updated_by: user?.id,
    });
    setSaving(false);
    if (error) toast.error("Could not save security settings."); else toast.success("Security settings saved");
  };

  const reset = async (p: Person) => {
    if (!confirm(`Reset Google Authenticator for ${p.full_name || p.email}? They will set it up again at their next sign-in.`)) return;
    const r = await mfaTools({ action: "admin_reset", user_id: p.user_id });
    if (r.error) return toast.error(r.error);
    toast.success("Authenticator reset");
    loadPeople();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Sign-in security</CardTitle>
        <CardDescription>Google Authenticator codes and password rules for everyone in this company.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Require Google Authenticator</Label>
            <p className="text-xs text-muted-foreground">Everyone must enter a 6-digit code from their phone when signing in and when approving anything. People without it set up will be guided through setup at their next sign-in.</p>
          </div>
          <Switch checked={mfa} disabled={saving} onCheckedChange={(v) => save({ mfa: v })} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Change password every</Label>
            <p className="text-xs text-muted-foreground">People are asked to choose a new password once this time has passed.</p>
          </div>
          <Select value={days} onValueChange={(v) => save({ days: v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["30", "60", "90", "180", "365"].map((d) => <SelectItem key={d} value={d}>{d} days</SelectItem>)}
              <SelectItem value="0">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Staff authenticator status</p>
          {!people ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <div className="max-h-72 overflow-y-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Authenticator</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {people.map((p) => (
                    <TableRow key={p.user_id}>
                      <TableCell>{p.full_name || "—"}</TableCell>
                      <TableCell className="text-xs">{p.email}</TableCell>
                      <TableCell>{p.has_authenticator ? <Badge variant="default">Set up</Badge> : <Badge variant="outline">Not set up</Badge>}</TableCell>
                      <TableCell className="text-right">
                        {p.has_authenticator && (
                          <Button size="sm" variant="ghost" onClick={() => reset(p)}><RotateCcw className="h-3 w-3 mr-1" /> Reset</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
