import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Paperclip, Upload, Trash2, FileText, Image, File, FileSpreadsheet, FileType, Download, Eye, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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

const getFileIcon = (contentType: string | null, fileName: string) => {
  if (contentType?.startsWith('image/')) return Image;
  if (contentType?.includes('pdf')) return FileText;
  if (contentType?.includes('spreadsheet') || contentType?.includes('excel') || fileName.match(/\.(xlsx?|csv)$/i)) return FileSpreadsheet;
  if (contentType?.includes('word') || contentType?.includes('document') || fileName.match(/\.docx?$/i)) return FileType;
  return File;
};

const isImageFile = (contentType: string | null) => contentType?.startsWith('image/');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function AttachmentPanel({ entityType, entityId }: AttachmentPanelProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

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

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const oversized = fileArray.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length) {
      toast.error(`Files over 10MB: ${oversized.map(f => f.name).join(', ')}`);
      return;
    }

    setUploading(true);
    let uploaded = 0;
    for (const file of fileArray) {
      const filePath = `${entityType}/${entityId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file);
      if (uploadError) { toast.error(`Failed: ${file.name}`); continue; }

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
      uploaded++;
    }
    if (uploaded > 0) toast.success(`${uploaded} file(s) uploaded`);
    setUploading(false);
    fetchAttachments();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) await uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Delete "${att.file_name}"?`)) return;
    const urlParts = att.file_url.split('/transaction-attachments/');
    if (urlParts[1]) {
      await supabase.storage.from('transaction-attachments').remove([urlParts[1]]);
    }
    await supabase.from('transaction_attachments').delete().eq('id', att.id);
    toast.success('Attachment deleted');
    fetchAttachments();
  };

  const handleBulkDownload = () => {
    attachments.forEach(att => {
      const link = document.createElement('a');
      link.href = att.file_url;
      link.download = att.file_name;
      link.target = '_blank';
      link.click();
    });
  };

  return (
    <>
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`space-y-3 rounded-lg border-2 border-dashed p-3 transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-transparent'
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Attachments ({attachments.length})
          </h3>
          <div className="flex gap-1">
            {attachments.length > 1 && (
              <Button variant="ghost" size="sm" onClick={handleBulkDownload} title="Download all">
                <Download className="h-3 w-3" />
              </Button>
            )}
            <label>
              <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span className="cursor-pointer"><Upload className="h-3 w-3 mr-1" /> {uploading ? 'Uploading...' : 'Upload'}</span>
              </Button>
            </label>
          </div>
        </div>

        {dragging && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            Drop files here to upload
          </div>
        )}

        {!dragging && attachments.length === 0 && (
          <p className="text-sm text-muted-foreground py-2 text-center">
            No attachments yet. Drag & drop files or click Upload.
          </p>
        )}

        {!dragging && attachments.length > 0 && (
          <div className="space-y-1">
            {attachments.map(att => {
              const Icon = getFileIcon(att.content_type, att.file_name);
              const isImage = isImageFile(att.content_type);
              return (
                <div key={att.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md group">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isImage ? (
                      <img
                        src={att.file_url}
                        alt={att.file_name}
                        className="h-8 w-8 rounded object-cover flex-shrink-0 cursor-pointer"
                        onClick={() => setPreviewUrl(att.file_url)}
                      />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate">
                      {att.file_name}
                    </a>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(att.file_size)}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {isImage && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setPreviewUrl(att.file_url)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDelete(att)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="w-full h-auto rounded" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
