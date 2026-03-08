import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Paperclip, Upload, Trash2, FileText, Image, File } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string;
  uploaded_by: string | null;
}

interface AttachmentPanelProps {
  entityType: string;
  entityId: string;
}

const formatBytes = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const getFileIcon = (contentType: string | null) => {
  if (!contentType) return File;
  if (contentType.startsWith('image/')) return Image;
  if (contentType.includes('pdf') || contentType.includes('document')) return FileText;
  return File;
};

export function AttachmentPanel({ entityType, entityId }: AttachmentPanelProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    const { data } = await supabase
      .from('transaction_attachments')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    setAttachments((data as Attachment[]) || []);
  }, [entityType, entityId]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `${entityType}/${entityId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file);
      if (uploadError) { toast.error(`Failed to upload ${file.name}: ${uploadError.message}`); continue; }

      const { data: urlData } = supabase.storage.from('transaction-attachments').getPublicUrl(filePath);

      await supabase.from('transaction_attachments').insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        content_type: file.type,
        uploaded_by: user?.id,
      });
    }
    toast.success('File(s) uploaded');
    setUploading(false);
    fetchAttachments();
    e.target.value = '';
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Delete "${att.file_name}"?`)) return;
    // Extract path from URL
    const urlParts = att.file_url.split('/transaction-attachments/');
    if (urlParts[1]) {
      await supabase.storage.from('transaction-attachments').remove([urlParts[1]]);
    }
    await supabase.from('transaction_attachments').delete().eq('id', att.id);
    toast.success('Attachment deleted');
    fetchAttachments();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Attachments ({attachments.length})
        </h3>
        <label>
          <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          <Button variant="outline" size="sm" asChild disabled={uploading}>
            <span className="cursor-pointer"><Upload className="h-3 w-3 mr-1" /> {uploading ? 'Uploading...' : 'Upload'}</span>
          </Button>
        </label>
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No attachments yet.</p>
      ) : (
        <div className="space-y-1">
          {attachments.map(att => {
            const Icon = getFileIcon(att.content_type);
            return (
              <div key={att.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md group">
                <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline truncate flex-1">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{att.file_name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(att.file_size)}</span>
                </a>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDelete(att)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
