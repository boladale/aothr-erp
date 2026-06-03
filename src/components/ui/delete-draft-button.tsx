import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteDraftTransaction, DraftDeleteOptions } from '@/lib/draft-delete';

interface Props extends Omit<DraftDeleteOptions, 'id' | 'status' | 'label'> {
  id: string;
  status: string | null | undefined;
  label: string;
  onDeleted?: () => void;
  size?: 'sm' | 'default';
  disabled?: boolean;
}

/**
 * Inline trash icon button that deletes a draft transactional record.
 * Hides itself entirely unless `status` is in `allowedStatuses` (default ['draft']).
 */
export function DeleteDraftButton({ onDeleted, size = 'sm', disabled, ...opts }: Props) {
  const allowed = opts.allowedStatuses ?? ['draft'];
  if (!opts.status || !allowed.includes(opts.status)) return null;
  return (
    <Button
      size={size}
      variant="ghost"
      className="text-destructive hover:text-destructive"
      title="Delete"
      disabled={disabled}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await deleteDraftTransaction(opts);
        if (ok) onDeleted?.();
      }}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
