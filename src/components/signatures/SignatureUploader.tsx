import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  userId: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  label?: string;
}

/**
 * Uploads a signature image to the `signatures` bucket under {userId}/sig-{ts}.{ext}
 * and returns the public URL via onUploaded.
 */
export function SignatureUploader({ userId, currentUrl, onUploaded, label = 'Signature' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image (PNG/JPG)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Signature must be under 2MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${userId}/sig-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('signatures').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('signatures').getPublicUrl(path);
      setPreviewUrl(data.publicUrl);
      onUploaded(data.publicUrl);
      toast.success('Signature uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {previewUrl ? (
        <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
          <img src={previewUrl} alt="signature" className="h-16 max-w-[180px] object-contain bg-white border rounded" />
          <div className="flex-1 text-sm text-muted-foreground flex items-center gap-1">
            <Check className="h-4 w-4 text-success" /> Signature on file
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            Replace
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full">
          <Upload className="h-4 w-4 mr-2" /> {uploading ? 'Uploading...' : 'Upload signature image'}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
