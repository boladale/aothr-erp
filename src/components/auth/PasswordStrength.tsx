import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checkPassword, suggestPassword } from "@/lib/password-strength";
import { cn } from "@/lib/utils";
import { Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";

/** Strength meter + "suggest a strong password" for any new-password field. */
export function PasswordStrength({ value, onUse }: { value: string; onUse: (pw: string) => void }) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const s = checkPassword(value);
  const colors = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];
  return (
    <div className="space-y-2">
      {value && (
        <>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn("h-1.5 flex-1 rounded", i < Math.max(1, s.score) ? colors[s.score] : "bg-muted")} />
            ))}
          </div>
          <p className={cn("text-xs", s.ok ? "text-success" : "text-destructive")}>
            {s.label}{!s.ok && s.tips[0] ? ` — ${s.tips[0]}` : ""}
          </p>
        </>
      )}
      {(!value || !s.ok) && (
        <div className="rounded-md border bg-muted/40 p-2 text-xs space-y-2">
          <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setSuggestion(suggestPassword())}>
            <Sparkles className="h-3 w-3 mr-1" /> Suggest a strong password
          </Button>
          {suggestion && (
            <div className="flex items-center gap-2 flex-wrap">
              <code className="rounded bg-background px-2 py-1 font-mono">{suggestion}</code>
              <Button type="button" size="sm" className="h-7" onClick={() => { onUse(suggestion); navigator.clipboard?.writeText(suggestion).catch(() => {}); toast.success("Password filled in and copied — save it somewhere safe."); }}>
                <Copy className="h-3 w-3 mr-1" /> Use this
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
