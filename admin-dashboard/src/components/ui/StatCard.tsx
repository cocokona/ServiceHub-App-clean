import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import Card from './Card';

interface StatCardProps {
  label: string;
  value: string;
  delta?: number;
  icon?: React.ReactNode;
  hint?: string;
}

export default function StatCard({ label, value, delta, icon, hint }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card bodyClassName="p-md">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="font-label-md text-label-md uppercase tracking-wide text-on-surface-variant">
            {label}
          </p>
          <p className="mt-xs font-headline-md text-headline-md text-on-surface">{value}</p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-sm flex items-center gap-xs">
        {typeof delta === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-xs font-label-md text-label-md',
              positive ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
        {hint && <span className="font-label-sm text-label-sm text-on-surface-variant">{hint}</span>}
      </div>
    </Card>
  );
}
