import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number; // 0..100
  label?: string;
  caption?: string;
  color?: string; // tailwind bg class
  delay?: number; // seconds
  className?: string;
}

export default function ProgressBar({
  value,
  label,
  caption,
  color = 'bg-primary-container',
  delay = 0,
  className,
}: ProgressBarProps) {
  return (
    <div className={className}>
      {(label || caption) && (
        <div className="mb-xs flex justify-between font-label-sm text-label-sm">
          <span className="text-on-surface">{label}</span>
          {caption && <span className="text-on-surface-variant font-mono-sm">{caption}</span>}
        </div>
      )}
      <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={cn('h-full rounded-full animate-bar-grow-h', color)}
          style={{ width: `${value}%`, animationDelay: `${delay}s`, transformOrigin: 'left' }}
        />
      </div>
    </div>
  );
}
