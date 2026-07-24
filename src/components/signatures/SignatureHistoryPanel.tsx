import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Download, PenLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadSignedPdf, refreshSignatureStatus, SignableDocumentType } from '@/lib/boldsign';
import { format } from 'date-fns';

interface Props {
  documentType: SignableDocumentType;
  documentId: string;
}

const statusColor: Record<string, string> = {
  sent: 'bg-blue-500/10 text-blue-700 border-blue-300',
  viewed: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
  signed: 'bg-green-500/10 text-green-700 border-green-300',
  declined: 'bg-red-500/10 text-red-700 border-red-300',
  expired: 'bg-gray-500/10 text-gray-700 border-gray-300',
  failed: 'bg-red-500/10 text-red-700 border-red-300',
  revoked: 'bg-gray-500/10 text-gray-700 border-gray-300',
};

export function SignatureHistoryPanel({ documentType, documentId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('signature_requests' as any)
      .select('*')
      .eq('document_type', documentType)
      .eq('document_id', documentId)
      .order('sent_at', { ascending: false });
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [documentType, documentId]);

  const refresh = async (id: string) => {
    setRefreshing(id);
    try { await refreshSignatureStatus(id); await load(); toast.success('Status refreshed'); }
    catch (err: any) { toast.error(err.message); }
    finally { setRefreshing(null); }
  };

  const download = async (path: string, number?: string) => {
    try { await downloadSignedPdf(path, `signed-${number || 'document'}.pdf`); }
    catch (err: any) { toast.error(err.message); }
  };

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <PenLine className="h-4 w-4" /> Signature History ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.signer_name} <span className="text-muted-foreground">&lt;{r.signer_email}&gt;</span></div>
              <div className="text-xs text-muted-foreground">
                Sent {format(new Date(r.sent_at), 'dd MMM yyyy HH:mm')}
                {r.signed_at && ` · Signed ${format(new Date(r.signed_at), 'dd MMM yyyy HH:mm')}`}
              </div>
              {r.error_message && <div className="text-xs text-red-600 mt-1 truncate">{r.error_message}</div>}
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="outline" className={statusColor[r.status] || ''}>{r.status}</Badge>
              {r.signed_pdf_url && (
                <Button size="sm" variant="outline" onClick={() => download(r.signed_pdf_url, r.document_number)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              {['sent', 'viewed'].includes(r.status) && (
                <Button size="sm" variant="ghost" onClick={() => refresh(r.id)} disabled={refreshing === r.id}>
                  {refreshing === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
