import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function OrganizationBranding() {
  const { organizationId, isAdmin } = useAuth();
  const [appName, setAppName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (organizationId) fetchBranding();
  }, [organizationId]);

  const fetchBranding = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('organizations')
      .select('app_name, logo_url')
      .eq('id', organizationId!)
      .single();
    if (data) {
      setAppName((data as any).app_name || '');
      setLogoUrl(data.logo_url || null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!organizationId) return;
    setSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({ app_name: appName || null, logo_url: logoUrl } as any)
      .eq('id', organizationId);
    if (error) {
      toast.error('Failed to save branding settings');
    } else {
      toast.success('Branding updated successfully');
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${organizationId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('org-logos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload logo');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('org-logos')
      .getPublicUrl(path);

    setLogoUrl(urlData.publicUrl + '?t=' + Date.now());
    setUploading(false);
    toast.success('Logo uploaded');
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Only administrators can manage branding settings.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Branding</CardTitle>
        <CardDescription>Customize your organization's app name and logo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="app-name">App Name</Label>
          <Input
            id="app-name"
            placeholder="e.g. My Company ERP"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            maxLength={50}
          />
          <p className="text-xs text-muted-foreground">
            This name will appear in the sidebar. Leave empty to use the default.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Organization Logo</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-lg">
              {logoUrl ? (
                <AvatarImage src={logoUrl} alt="Logo" className="object-contain" />
              ) : null}
              <AvatarFallback className="rounded-lg bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Upload
              </Button>
              {logoUrl && (
                <Button variant="outline" size="sm" onClick={handleRemoveLogo}>
                  <X className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
          <p className="text-xs text-muted-foreground">Max 2MB. PNG or SVG recommended.</p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Branding
        </Button>
      </CardContent>
    </Card>
  );
}
