import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Download, Trash2, Loader2, HardDrive, Clock, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Backup {
  id: string;
  backup_name: string;
  tables_included: string[];
  file_size: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface VerifyResult {
  ok: boolean;
  file_size: number;
  table_count: number;
  total_backup_rows: number;
  total_live_rows: number;
  drift_count: number;
  message: string;
  tables: Array<{ table: string; backup_count: number; live_count: number; status: 'match' | 'drift' | 'missing' }>;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export function BackupManagementPanel() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ backup: Backup; result: VerifyResult } | null>(null);

  const fetchBackups = useCallback(async () => {
    const { data } = await supabase
      .from('data_backups')
      .select('*')
      .order('created_at', { ascending: false });
    setBackups((data as Backup[]) || []);
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-backup', {
        body: { action: 'create' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message);
        fetchBackups();
      } else {
        toast.error(data?.message || 'Backup failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Backup failed');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (backup: Backup) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-backup', {
        body: { action: 'download', backup_id: backup.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message);
      
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${backup.backup_name.replace(/\s+/g, '-').toLowerCase()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    }
  };

  const handleVerify = async (backup: Backup) => {
    setVerifyingId(backup.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-backup', {
        body: { action: 'verify', backup_id: backup.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message);
      setVerifyResult({ backup, result: data as VerifyResult });
      if (data.ok) toast.success('Backup verified ✓');
      else toast.warning(`Backup readable — ${data.drift_count} table(s) drifted`);
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-backup', {
        body: { action: 'delete', backup_id: confirmDeleteId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Backup deleted');
        fetchBackups();
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" /> Backup & Restore
            </CardTitle>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Backup'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Use <span className="font-medium">Verify</span> to confirm a backup is readable and its row counts still match live data. Use <span className="font-medium">Download</span> to keep an offline copy for supervised restore.
          </p>
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No backups yet. Create your first backup to protect your data.
            </p>
          ) : (
            <div className="space-y-2">
              {backups.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{b.backup_name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        b.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(b.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                      <span>{formatSize(b.file_size)}</span>
                      <span>{b.tables_included.length} tables</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleVerify(b)}
                      disabled={verifyingId === b.id}
                      title="Verify backup integrity"
                    >
                      {verifyingId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Verify
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(b)} title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setConfirmDeleteId(b.id)}
                      disabled={deletingId === b.id}
                      title="Delete"
                    >
                      {deletingId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this backup file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!verifyResult} onOpenChange={() => setVerifyResult(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {verifyResult?.result.ok ? (
                <><CheckCircle2 className="h-5 w-5 text-green-600" /> Backup Verified</>
              ) : (
                <><AlertTriangle className="h-5 w-5 text-yellow-600" /> Verification: Drift Detected</>
              )}
            </DialogTitle>
          </DialogHeader>
          {verifyResult && (
            <div className="space-y-3">
              <p className="text-sm">{verifyResult.result.message}</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-muted rounded">
                  <div className="text-xs text-muted-foreground">Tables</div>
                  <div className="font-semibold">{verifyResult.result.table_count}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-xs text-muted-foreground">Rows in file</div>
                  <div className="font-semibold">{verifyResult.result.total_backup_rows.toLocaleString()}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-xs text-muted-foreground">Live rows</div>
                  <div className="font-semibold">{verifyResult.result.total_live_rows.toLocaleString()}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-xs text-muted-foreground">Drifted</div>
                  <div className={`font-semibold ${verifyResult.result.drift_count ? 'text-yellow-600' : 'text-green-600'}`}>
                    {verifyResult.result.drift_count}
                  </div>
                </div>
              </div>
              <ScrollArea className="h-64 border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Table</th>
                      <th className="text-right p-2">In backup</th>
                      <th className="text-right p-2">Live now</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifyResult.result.tables.map(t => (
                      <tr key={t.table} className="border-t">
                        <td className="p-2 font-mono text-xs">{t.table}</td>
                        <td className="p-2 text-right">{t.backup_count.toLocaleString()}</td>
                        <td className="p-2 text-right">{t.live_count.toLocaleString()}</td>
                        <td className="p-2 text-center">
                          {t.status === 'match' && <span className="text-green-600 text-xs">✓ match</span>}
                          {t.status === 'drift' && <span className="text-yellow-600 text-xs">↕ drift</span>}
                          {t.status === 'missing' && <span className="text-red-600 text-xs">✗ missing</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                Drift is normal for older backups — it just means the live system has changed since the backup was taken. What matters is that the file is readable and its row counts are what you expect for that point in time.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyResult(null)}>Close</Button>
            {verifyResult && (
              <Button onClick={() => handleDownload(verifyResult.backup)} className="gap-2">
                <Download className="h-4 w-4" /> Download JSON
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
