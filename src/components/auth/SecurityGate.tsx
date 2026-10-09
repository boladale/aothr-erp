import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { getVerifiedTotp, mfaTools, verifyTotp } from "@/lib/mfa";
import { NewPasswordForm } from "./NewPasswordForm";
import { BackupCodesView } from "./BackupCodesView";

type Step = "loading" | "challenge" | "enroll" | "codes" | "password" | "ok";

function Shell({ icon, title, desc, children, onSignOut }: any) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">{icon}</div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <button onClick={onSignOut} className="block w-full text-center text-sm text-muted-foreground underline">Sign out</button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Enforces: authenticator code at sign-in, required authenticator setup, and password expiry. */
export function SecurityGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<Step>("loading");
  const [status, setStatus] = useState<any>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);

  const evaluate = useCallback(async () => {
    const { data: st } = await supabase.rpc("get_my_security_status" as any);
    setStatus(st);
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return setStep("challenge");
    const factor = await getVerifiedTotp();
    if ((st as any)?.mfa_required && !factor) return setStep("enroll");
    if ((st as any)?.password_expired) return setStep("password");
    setStep("ok");
  }, []);

  useEffect(() => { if (user) evaluate(); }, [user?.id, evaluate]);

  const startEnroll = useCallback(async () => {
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of (list?.all ?? []).filter((f: any) => f.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now()}`, issuer: "Aothr ERP" } as any);
    if (error || !data) return toast.error("Could not start setup. Please refresh and try again.");
    setEnroll({ id: data.id, qr: (data as any).totp.qr_code, secret: (data as any).totp.secret });
  }, []);
  useEffect(() => { if (step === "enroll" && !enroll) startEnroll(); }, [step, enroll, startEnroll]);

  const submitChallenge = async () => {
    setBusy(true);
    if (useBackup) {
      const r = await mfaTools({ action: "redeem_backup_code", code });
      setBusy(false);
      if (r.error) return toast.error(r.error);
      toast.success("Backup code accepted. Please set up your authenticator again on your new phone.");
      await supabase.auth.refreshSession();
      setCode(""); setUseBackup(false); setEnroll(null); setStep("enroll");
      return;
    }
    const f = await getVerifiedTotp();
    const err = f ? await verifyTotp(f.id, code) : new Error("none");
    setBusy(false);
    if (err) return toast.error("That code is not correct. Check the time on your phone and try again.");
    setCode(""); evaluate();
  };

  const submitEnroll = async () => {
    if (!enroll) return;
    setBusy(true);
    const err = await verifyTotp(enroll.id, code);
    if (err) { setBusy(false); return toast.error("That code is not correct. Try the newest code in the app."); }
    const r = await mfaTools<{ codes: string[] }>({ action: "generate_backup_codes" });
    setBusy(false); setCode("");
    if (r.codes) { setCodes(r.codes); setStep("codes"); } else evaluate();
  };

  if (step === "ok") return <>{children}</>;
  if (step === "loading") return <div className="flex min-h-screen items-center justify-center">Loading...</div>;

  const codeInput = (
    <div className="space-y-2">
      <Label htmlFor="otp">{useBackup ? "Backup code" : "6-digit code"}</Label>
      <Input id="otp" autoFocus inputMode={useBackup ? "text" : "numeric"} autoComplete="one-time-code" value={code}
        onChange={(e) => setCode(e.target.value)} placeholder={useBackup ? "XXXXX-XXXXX" : "123456"}
        onKeyDown={(e) => e.key === "Enter" && (step === "enroll" ? submitEnroll() : submitChallenge())} />
    </div>
  );

  if (step === "challenge") return (
    <Shell icon={<ShieldCheck className="h-7 w-7 text-primary" />} title="Enter your authenticator code"
      desc="Open Google Authenticator on your phone and type the 6-digit code for Aothr ERP." onSignOut={signOut}>
      {codeInput}
      <Button className="w-full" onClick={submitChallenge} disabled={busy || !code}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Continue</Button>
      <button className="block w-full text-center text-sm text-primary underline" onClick={() => { setUseBackup(!useBackup); setCode(""); }}>
        {useBackup ? "Use my authenticator code instead" : "Lost your phone? Use a backup code"}
      </button>
    </Shell>
  );

  if (step === "enroll") return (
    <Shell icon={<ShieldCheck className="h-7 w-7 text-primary" />} title="Set up Google Authenticator"
      desc="Your company requires a sign-in code from your phone." onSignOut={signOut}>
      <ol className="list-decimal pl-5 text-sm space-y-1 text-muted-foreground">
        <li>Install <b>Google Authenticator</b> from the App Store or Play Store.</li>
        <li>In the app tap <b>+</b> then <b>Scan a QR code</b>, and scan the code below.</li>
        <li>Type the 6-digit code it shows.</li>
      </ol>
      {enroll ? (
        <div className="flex flex-col items-center gap-2">
          <img src={enroll.qr} alt="QR code for Google Authenticator" className="h-44 w-44 rounded bg-card p-2 border" />
          <p className="text-xs text-muted-foreground text-center">Can't scan? Enter this key: <code className="font-mono break-all">{enroll.secret}</code></p>
        </div>
      ) : <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      {codeInput}
      <Button className="w-full" onClick={submitEnroll} disabled={busy || !code || !enroll}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Turn on</Button>
    </Shell>
  );

  if (step === "codes") return (
    <Shell icon={<ShieldCheck className="h-7 w-7 text-primary" />} title="Authenticator is on" desc="Save your backup codes before continuing." onSignOut={signOut}>
      <BackupCodesView codes={codes} />
      <Button className="w-full" onClick={evaluate}>I've saved them — continue</Button>
    </Shell>
  );

  return (
    <Shell icon={<KeyRound className="h-7 w-7 text-primary" />} title="Time to change your password"
      desc={`Your company requires a new password every ${status?.password_max_age_days ?? 90} days.`} onSignOut={signOut}>
      <NewPasswordForm onDone={evaluate} />
    </Shell>
  );
}
