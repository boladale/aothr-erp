import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Copy, Link2, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface VendorInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
}

export function VendorInviteDialog({ open, onOpenChange, vendorId, vendorName, vendorEmail }: VendorInviteDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(vendorEmail || '');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: existingTokens = [] } = useQuery({
    queryKey: ['vendor-invite-tokens', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_invite_tokens' as any)
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!email) throw new Error('Email is required');
      const { data, error } = await supabase
        .from('vendor_invite_tokens' as any)
        .insert({
          vendor_id: vendorId,
          email,
          created_by: user?.id,
        } as any)
        .select('token')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const link = `${window.location.origin}/vendor-portal/login?invite=${data.token}`;
      setGeneratedLink(link);
      queryClient.invalidateQueries({ queryKey: ['vendor-invite-tokens', vendorId] });
      toast.success('Invite link generated!');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to generate invite'),
  });

  const handleCopy = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setGeneratedLink(null);
    setCopied(false);
    setEmail(vendorEmail || '');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Invite to Vendor Portal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a one-time invite link for <strong>{vendorName}</strong> to create their vendor portal account.
          </p>

          <div className="space-y-2">
            <Label>Vendor Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendor@company.com"
            />
          </div>

          {!generatedLink ? (
            <Button onClick={() => generateMutation.mutate()} disabled={!email || generateMutation.isPending} className="w-full">
              {generateMutation.isPending ? 'Generating...' : 'Generate Invite Link'}
            </Button>
          ) : (
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Share this link with the vendor. It expires in 7 days.</p>
            </div>
          )}

          {existingTokens.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Previous Invites</Label>
              {(existingTokens as any[]).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                  <div>
                    <span>{t.email}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(t.created_at), 'dd MMM yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {t.used_at ? (
                      <span className="text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Used</span>
                    ) : new Date(t.expires_at) < new Date() ? (
                      <span className="text-destructive flex items-center gap-1"><Clock className="h-3 w-3" /> Expired</span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
