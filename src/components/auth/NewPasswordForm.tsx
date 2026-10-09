import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordStrength } from "./PasswordStrength";
import { checkPassword } from "@/lib/password-strength";
import { friendlyError } from "@/lib/friendly-error";

/** Signed-in password change with strength check; records the change date for the expiry rule. */
export function NewPasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPassword(pw).ok) return toast.error("That password is too weak. Use the suggestion or add capitals, numbers and symbols.");
    if (pw !== confirm) return toast.error("Passwords do not match");
    if (pw === current) return toast.error("Choose a password different from your current one.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: current } as any);
    if (error) { setLoading(false); return toast.error(friendlyError(error, "Failed to update password")); }
    await supabase.rpc("mark_password_changed" as any);
    setLoading(false);
    toast.success("Password updated");
    setCurrent(""); setPw(""); setConfirm("");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cur-pw">Current password</Label>
        <Input id="cur-pw" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pw">New password</Label>
        <Input id="new-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <PasswordStrength value={pw} onUse={(p) => { setPw(p); setConfirm(p); }} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-pw">Confirm new password</Label>
        <Input id="confirm-pw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>}
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update password</Button>
      </div>
    </form>
  );
}
