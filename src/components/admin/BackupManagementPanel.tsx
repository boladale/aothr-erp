import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Database, Download, Trash2, Loader2, HardDrive, Clock } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Backup {
  id: string;
  backup_name: string;
  tables_included: string[];
  file_size: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    </>
  );
}
