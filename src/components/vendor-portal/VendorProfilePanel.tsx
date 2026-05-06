import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SignatureUploader } from '@/components/signatures/SignatureUploader';
import { toast } from 'sonner';

interface Props {
  userId: string;
  vendorUser: any;
  onUpdated?: () => void;
}

export function VendorProfilePanel({ userId, vendorUser, onUpdated }: Props) {
  const [sigUrl, setSigUrl] = useState<string | null>(vendorUser?.signature_url || null);
  const vendor = vendorUser?.vendors;

  const handleUploaded = async (url: string) => {
    const { error } = await supabase
      .from('vendor_users' as any)
      .update({ signature_url: url } as any)
      .eq('user_id', userId);
    if (error) {
      toast.error('Failed to save signature: ' + error.message);
      return;
    }
    setSigUrl(url);
    onUpdated?.();
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Vendor Information</CardTitle>
          <CardDescription>Your registered vendor details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{vendor?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Code</span><span className="font-mono">{vendor?.code}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{vendor?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="capitalize">{vendor?.status}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signature</CardTitle>
          <CardDescription>
            Upload your signature image. It will be applied automatically when you accept Purchase Orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignatureUploader
            userId={userId}
            currentUrl={sigUrl}
            onUploaded={handleUploaded}
            label="Authorized Signature"
          />
        </CardContent>
      </Card>
    </div>
  );
}
