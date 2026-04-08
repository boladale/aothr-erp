import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
}

export function BulkActionBar({ selectedCount, actions, onClearSelection }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-primary/5 border-primary/20 p-3 animate-in slide-in-from-top-2">
      <span className="text-sm font-medium text-foreground">{selectedCount} selected</span>
      <div className="flex items-center gap-2 ml-auto">
        {actions.map((action, i) => (
          <Button
            key={i}
            size="sm"
            variant={action.variant || 'outline'}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
