import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getVerifiedTotp, verifyTotp } from "@/lib/mfa";

type Pending = { factorId: string; label: string; resolve: (ok: boolean) => void };
let open: ((p: Pending) => void) | null = null;

/**
 * Ask for a fresh Google Authenticator code before an approval.
 * Resolves true when verified (or when the user has no authenticator), false if cancelled.
 */
export async function requireApprovalCode(label = "this approval"): Promise<boolean> {
  const factor = await getVerifiedTotp();
  if (!factor || !open) return true;
  return new Promise((resolve) => open!({ factorId: factor.id, label, resolve }));
}

/** Throwing variant for use inside mutations. */
export async function assertApprovalCode(label?: string) {
  if (!(await requireApprovalCode(label))) throw new Error("Approval cancelled — authenticator code not entered.");
}

export function ApprovalCodeDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { open = (p) => { setCode(""); setPending(p); }; return () => { open = null; }; }, []);

  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null); };
  const submit = async () => {
    if (!pending) return;
    setBusy(true);
    const err = await verifyTotp(pending.factorId, code);
    setBusy(false);
    if (err) return toast.error("That code is not correct. Try the newest code in Google Authenticator.");
    close(true);
  };

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && close(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Confirm with your code</DialogTitle>
          <DialogDescription>Enter the 6-digit code from Google Authenticator to confirm {pending?.label}.</DialogDescription>
        </DialogHeader>
        <Input autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code}
          onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || code.length < 6}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
