import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function MetricCard({ title, value, icon: Icon, trend, className }: MetricCardProps) {
  return (
    <div className={cn('metric-card', className)}>
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {trend && (
          <span className={cn(
            'text-xs font-medium',
            trend.isPositive ? 'text-success' : 'text-destructive'
          )}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="metric-value">{value}</p>
        <p className="metric-label">{title}</p>
      </div>
    </div>
  );
}
