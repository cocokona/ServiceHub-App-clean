import { cn } from '../../lib/utils';

export type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  error: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-primary-fixed text-on-primary-fixed-variant ring-primary/20',
  neutral: 'bg-surface-container-high text-on-surface-variant ring-outline-variant',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export default function Badge({ tone = 'neutral', children, dot, className }: BadgeProps) {
  const dotColor: Record<BadgeTone, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500',
    info: 'bg-primary-container',
    neutral: 'bg-outline',
  };
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-xs rounded-full px-2 font-label-md text-label-md ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColor[tone])} />}
      {children}
    </span>
  );
}
