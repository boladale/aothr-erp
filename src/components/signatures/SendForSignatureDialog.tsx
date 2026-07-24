import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, PenLine, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sendForSignature, htmlToPdfBase64, SignableDocumentType } from '@/lib/boldsign';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: SignableDocumentType;
  documentId: string;
  documentNumber?: string;
  title: string;                        // e.g. "Purchase Order PO-2026-0001"
  /** Either pass HTML that will be rendered to PDF, OR pass an already-encoded pdfBase64 */
  html?: string;
  pdfBase64?: string;
  defaultSignerName?: string;
  defaultSignerEmail?: string;
  onSent?: () => void;
}

export function SendForSignatureDialog({
  open, onOpenChange, documentType, documentId, documentNumber,
  title, html, pdfBase64, defaultSignerName, defaultSignerEmail, onSent,
}: Props) {
  const { organizationId } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [signerName, setSignerName] = useState(defaultSignerName || '');
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail || '');
  const [message, setMessage] = useState('Please review and sign this document.');
  const [sending, setSending] = useState(false);

  useEffect(() => { setSignerName(defaultSignerName || ''); }, [defaultSignerName]);
  useEffect(() => { setSignerEmail(defaultSignerEmail || ''); }, [defaultSignerEmail]);

  useEffect(() => {
    if (!open || !organizationId) return;
    supabase.rpc('get_org_boldsign_settings', { _org_id: organizationId } as any)
      .then(({ data }: any) => {
        const row = Array.isArray(data) ? data[0] : data;
        setEnabled(!!(row?.boldsign_enabled && row?.has_api_key));
      });
  }, [open, organizationId]);

  const submit = async () => {
    if (!signerName || !signerEmail) { toast.error('Signer name and email required'); return; }
    setSending(true);
    try {
      let b64 = pdfBase64;
      if (!b64) {
        if (!html) throw new Error('No document content to sign');
        b64 = await htmlToPdfBase64(html);
      }
      await sendForSignature({
        documentType, documentId, documentNumber,
        signerName, signerEmail, title, message,
        pdfBase64: b64,
      });
      toast.success(`Sent to ${signerEmail} for signature`);
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="h-5 w-5" /> Send for E-Signature</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {enabled === false && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              BoldSign is not configured for your organization. An admin must add a BoldSign API key in
              <strong> Admin → Organization Settings</strong> before you can send documents for signature.
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Signer name</Label>
            <Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Vendor contact name" />
          </div>
          <div className="space-y-1">
            <Label>Signer email</Label>
            <Input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} placeholder="vendor@example.com" />
          </div>
          <div className="space-y-1">
            <Label>Message (optional)</Label>
            <Textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={submit} disabled={sending || enabled === false}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send for signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
