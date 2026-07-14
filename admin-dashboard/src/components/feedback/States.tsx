import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Small inline spinner. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary-container', className)} />;
}

/** Centered loading placeholder with an accessible status label. */
export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-md py-xl text-on-surface-variant"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary-container" />
      <span className="font-label-md text-label-md">{label}</span>
    </div>
  );
}

/** Error surface with optional retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-md rounded-lg border border-rose-200 bg-rose-50/60 px-lg py-xl text-center"
      role="alert"
    >
      <AlertCircle className="h-7 w-7 text-rose-500" />
      <div>
        <p className="font-body-md text-body-md text-on-surface">Couldn’t load data</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-xs rounded bg-primary-container px-md py-sm font-label-md text-label-md text-white transition-colors hover:bg-primary"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      )}
    </div>
  );
}

/** Friendly empty state when a query succeeds with zero rows. */
export function EmptyState({
  title,
  desc,
  icon,
}: {
  title: string;
  desc?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant px-lg py-xl text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="font-body-md text-body-md text-on-surface">{title}</p>
      {desc && <p className="max-w-sm font-label-sm text-label-sm text-on-surface-variant">{desc}</p>}
    </div>
  );
}

/** Pulse placeholder for skeleton layouts. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-surface-container-high', className)} />;
}
