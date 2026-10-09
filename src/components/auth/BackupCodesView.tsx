import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

export function BackupCodesView({ codes }: { codes: string[] }) {
  const text = codes.join("\n");
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Keep these backup codes somewhere safe. If you lose your phone, each code lets you sign in once and set up the authenticator again.
        They will not be shown again.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(text); toast.success("Copied"); }}>
          <Copy className="h-3 w-3 mr-1" /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([`Aothr backup codes\n\n${text}\n`], { type: "text/plain" }));
          a.download = "aothr-backup-codes.txt"; a.click();
        }}>
          <Download className="h-3 w-3 mr-1" /> Download
        </Button>
      </div>
    </div>
  );
}
