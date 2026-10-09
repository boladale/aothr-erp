import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { NewPasswordForm } from '@/components/auth/NewPasswordForm';
import { BackupCodesView } from '@/components/auth/BackupCodesView';
import { getVerifiedTotp, mfaTools } from '@/lib/mfa';
import { requireApprovalCode } from '@/components/auth/ApprovalCodeDialog';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [hasMfa, setHasMfa] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setCodes(null); getVerifiedTotp().then((f) => setHasMfa(!!f)); } }, [open]);

  const newCodes = async () => {
    if (!(await requireApprovalCode('new backup codes'))) return;
    setBusy(true);
    const r = await mfaTools<{ codes: string[] }>({ action: 'generate_backup_codes' });
    setBusy(false);
    if (r.error) return toast.error(r.error);
    setCodes(r.codes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Password &amp; security</DialogTitle>
        </DialogHeader>
        <NewPasswordForm onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
        {hasMfa && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Google Authenticator is on</p>
            {codes ? <BackupCodesView codes={codes} /> : (
              <Button variant="outline" size="sm" onClick={newCodes} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Get new backup codes
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
