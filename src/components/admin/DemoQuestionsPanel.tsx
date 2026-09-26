import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";

type Row = { asked_at: string; conversation_id: string; question: string; answer: string | null; tools_used: string[] | null; weak: boolean };

export function DemoQuestionsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [onlyWeak, setOnlyWeak] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    (supabase.rpc as any)("ai_demo_questions", { p_days: 90 }).then(({ data }: any) => setRows(data ?? []));
  }, []);

  const shown = onlyWeak ? rows.filter((r) => r.weak) : rows;
  const weakCount = rows.filter((r) => r.weak).length;

  const exportCsv = () => {
    const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const csv = ["Asked at,Question,Answer,Needs attention",
      ...shown.map((r) => [new Date(r.asked_at).toLocaleString(), esc(r.question), esc(r.answer ?? ""), r.weak ? "Yes" : "No"].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "demo-questions.csv"; a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo visitor questions</CardTitle>
        <CardDescription>
          What website visitors asked Aothr in the last 90 days. {rows.length} questions, {weakCount} where Aothr may not have answered well.
        </CardDescription>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant={onlyWeak ? "default" : "outline"} onClick={() => setOnlyWeak(!onlyWeak)}>
            {onlyWeak ? "Show all" : "Only ones needing attention"}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!shown.length}><Download className="mr-1 h-4 w-4" />Export</Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-[480px] space-y-2 overflow-y-auto">
        {shown.length === 0 && <p className="text-sm text-muted-foreground">No demo questions yet.</p>}
        {shown.map((r, i) => (
          <div key={i} className="cursor-pointer rounded-md border p-3 text-sm hover:bg-muted/50" onClick={() => setOpen(open === i ? null : i)}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{r.question}</span>
              <div className="flex shrink-0 items-center gap-2">
                {r.weak && <Badge variant="destructive">Needs attention</Badge>}
                <span className="text-xs text-muted-foreground">{new Date(r.asked_at).toLocaleDateString()}</span>
              </div>
            </div>
            {open === i && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{r.answer ?? "No answer was given."}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
