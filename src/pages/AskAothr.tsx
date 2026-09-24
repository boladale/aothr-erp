import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, Plus, Trash2, Send, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type Conv = { id: string; title: string; updated_at: string };

const SUGGESTIONS = [
  "How is my business doing?",
  "Compare this year's profit with last year to date",
  "Who owes us the most money?",
  "Which purchase orders are overdue?",
  "What stock needs reordering?",
  "What are my biggest expenses this year?",
];

export default function AskAothr() {
  const { toast } = useToast();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConvs = async () => {
    const { data } = await (supabase.from("ai_conversations" as any) as any)
      .select("id,title,updated_at").order("updated_at", { ascending: false }).limit(50);
    setConvs(data ?? []);
  };
  useEffect(() => { loadConvs(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const open = async (id: string) => {
    setActive(id);
    const { data } = await (supabase.from("ai_messages" as any) as any)
      .select("role,content").eq("conversation_id", id).order("created_at");
    setMsgs(data ?? []);
  };
  const newChat = () => { setActive(null); setMsgs([]); };
  const remove = async (id: string) => {
    await (supabase.from("ai_conversations" as any) as any).delete().eq("id", id);
    if (active === id) newChat();
    loadConvs();
  };

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("ask-aothr", { body: { question, conversationId: active } });
    setBusy(false);
    let errMsg = data?.error;
    if (error && !errMsg) {
      try { errMsg = (await (error as any).context?.json())?.error; } catch { /* ignore */ }
      errMsg = errMsg || "Aothr could not answer right now.";
    }
    if (errMsg) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${errMsg}` }]);
      return;
    }
    setMsgs((m) => [...m, { role: "assistant", content: data.answer }]);
    if (!active) setActive(data.conversationId);
    loadConvs();
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-7rem)] gap-4">
        <Card className="hidden w-64 shrink-0 flex-col md:flex">
          <div className="border-b p-3">
            <Button className="w-full" size="sm" onClick={newChat}><Plus className="mr-1 h-4 w-4" />New chat</Button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {convs.length === 0 && <p className="p-2 text-xs text-muted-foreground">No chats yet.</p>}
            {convs.map((c) => (
              <div key={c.id} className={cn("group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer", active === c.id && "bg-muted")}
                onClick={() => open(c.id)}>
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{c.title}</span>
                <button aria-label="Delete chat" className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); remove(c.id); }}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-semibold">Ask Aothr</h1>
              <p className="text-xs text-muted-foreground">Answers come only from your company's figures, limited to what your role can see.</p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <div className="mx-auto max-w-xl pt-10 text-center">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
                <h2 className="mb-1 text-lg font-semibold">What would you like to know?</h2>
                <p className="mb-6 text-sm text-muted-foreground">Try one of these:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" className="h-auto justify-start whitespace-normal py-2 text-left text-sm" onClick={() => ask(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  {m.content.replace(/\*\*(.+?)\*\*/g, "$1")}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Aothr is looking at your figures…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about sales, cash, stock, purchasing…" rows={1}
              className="min-h-[40px] resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
            <Button type="submit" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
