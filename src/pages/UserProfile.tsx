import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useOrgBranding } from '@/hooks/useOrgBranding';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SignatureUploader } from '@/components/signatures/SignatureUploader';
import { toast } from 'sonner';
import { User, Mail, Shield, Building2, Save, PenTool } from 'lucide-react';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  procurement_manager: 'Procurement Manager',
  procurement_officer: 'Procurement Officer',
  warehouse_manager: 'Warehouse Manager',
  warehouse_officer: 'Warehouse Officer',
  accounts_payable: 'Accounts Payable',
  ap_clerk: 'AP Clerk',
  requisitioner: 'Requisitioner',
  viewer: 'Viewer',
};

export default function UserProfile() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const { appName } = useOrgBranding();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('signature_url').eq('user_id', user.id).maybeSingle()
      .then(({ data }: any) => { if (data?.signature_url) setSignatureUrl(data.signature_url); });
  }, [user?.id]);

  const saveSignature = async (url: string) => {
    setSignatureUrl(url);
    if (!user?.id) return;
    const { error } = await supabase.from('profiles').update({ signature_url: url } as any).eq('user_id', user.id);
    if (error) toast.error('Failed to save signature');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U';

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View and manage your account information"
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-lg font-semibold text-foreground">
              {profile?.full_name || 'No name set'}
            </h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Separator className="my-4 w-full" />
            <div className="flex flex-wrap gap-2 justify-center">
              {roles.map(role => (
                <Badge key={role} variant="secondary">
                  <Shield className="h-3 w-3 mr-1" />
                  {roleLabels[role] || role}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact your administrator for assistance.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Organization
              </Label>
              <Input
                value={appName}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Roles
              </Label>
              <div className="flex flex-wrap gap-2">
                {roles.length > 0 ? roles.map(role => (
                  <Badge key={role} variant="outline">
                    {roleLabels[role] || role}
                  </Badge>
                )) : (
                  <span className="text-sm text-muted-foreground">No roles assigned</span>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
