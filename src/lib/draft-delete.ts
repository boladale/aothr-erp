import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DraftDeleteOptions {
  /** Parent table name (cast to any internally to bypass type narrowing). */
  table: string;
  /** Record id. */
  id: string;
  /** Current status — must equal 'draft' (or matchStatus). */
  status: string | null | undefined;
  /** Optional override of allowed status values. Defaults to ['draft']. */
  allowedStatuses?: string[];
  /** Optional child table to clear first. */
  childTable?: string;
  /** Optional column on child that references parent id. */
  childKey?: string;
  /** Optional secondary child cleanup (e.g. allocations). */
  extraCleanup?: Array<{ table: string; key: string; value: string }>;
  /** Human label (e.g. "Invoice INV-001") for confirm + toast. */
  label: string;
}

/**
 * Confirms with user and deletes a draft transactional record + its lines.
 * Returns true on success, false otherwise.
 */
export async function deleteDraftTransaction(opts: DraftDeleteOptions): Promise<boolean> {
  const allowed = opts.allowedStatuses ?? ['draft'];
  if (!opts.status || !allowed.includes(opts.status)) {
    toast.error(`Only ${allowed.join('/')} records can be deleted`);
    return false;
  }
  if (!window.confirm(`Delete ${opts.label}? This cannot be undone.`)) return false;
  try {
    for (const extra of opts.extraCleanup ?? []) {
      await (supabase.from(extra.table as any) as any).delete().eq(extra.key, extra.value);
    }
    if (opts.childTable && opts.childKey) {
      await (supabase.from(opts.childTable as any) as any).delete().eq(opts.childKey, opts.id);
    }
    const { error } = await (supabase.from(opts.table as any) as any).delete().eq('id', opts.id);
    if (error) throw error;
    toast.success(`${opts.label} deleted`);
    return true;
  } catch (err: any) {
    toast.error(err?.message || `Failed to delete ${opts.label}`);
    return false;
  }
}
