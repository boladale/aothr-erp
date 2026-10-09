import { supabase } from "@/integrations/supabase/client";

export async function getVerifiedTotp() {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.find((f) => f.status === "verified") ?? null;
}

export async function verifyTotp(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
  return error;
}

export async function mfaTools<T = any>(body: Record<string, unknown>): Promise<T & { error?: string }> {
  const { data, error } = await supabase.functions.invoke("mfa-tools", { body });
  if (error) return { error: "Something went wrong. Please try again." } as any;
  return data;
}
