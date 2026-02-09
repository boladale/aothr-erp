import { cn } from '@/lib/utils';
import type { VendorStatus, POStatus } from '@/lib/supabase';

interface StatusBadgeProps {
  status: VendorStatus | POStatus | string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-warning/15 text-warning border border-warning/30',
  active: 'bg-success/15 text-success border border-success/30',
  inactive: 'bg-muted text-muted-foreground',
  approved: 'bg-success/15 text-success border border-success/30',
  sent: 'bg-info/15 text-info border border-info/30',
  partially_received: 'bg-warning/15 text-warning border border-warning/30',
  fully_received: 'bg-success/15 text-success border border-success/30',
  closed: 'bg-muted text-muted-foreground',
  posted: 'bg-success/15 text-success border border-success/30',
  rejected: 'bg-destructive/15 text-destructive border border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground',
  partially_converted: 'bg-info/15 text-info border border-info/30',
  fully_converted: 'bg-success/15 text-success border border-success/30',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  active: 'Active',
  inactive: 'Inactive',
  approved: 'Approved',
  sent: 'Sent',
  partially_received: 'Partial',
  fully_received: 'Received',
  closed: 'Closed',
  posted: 'Posted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  partially_converted: 'Partially Converted',
  fully_converted: 'Fully Converted',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.draft;
  const label = statusLabels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      style,
      className
    )}>
      {label}
    </span>
  );
}
