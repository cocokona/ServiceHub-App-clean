import { cn } from '../../lib/utils';

export interface DonutSegment {
  label: string;
  value: number; // percentage 0..100
  color: string; // tailwind text-* class for stroke
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
}

export default function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 160,
}: DonutChartProps) {
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="-rotate-90" width={size} height={size}>
        <path
          className="text-surface-container-high"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
        />
        {segments.map((seg) => {
          const dash = `${seg.value}, ${100 - seg.value}`;
          const el = (
            <path
              key={seg.label}
              className={seg.color}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth={4}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += seg.value;
          return el;
        })}
      </svg>
      {centerValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-headline-lg text-headline-lg text-on-surface">{centerValue}</span>
          {centerLabel && (
            <span className="font-label-sm text-label-sm text-on-surface-variant">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  return (
    <ul className="flex flex-col gap-sm">
      {segments.map((s) => (
        <li key={s.label} className="flex items-center justify-between gap-md">
          <span className="flex items-center gap-xs">
            <span className={cn('h-3 w-3 rounded-sm', s.color.replace('text-', 'bg-'))} />
            <span className="font-label-md text-label-md text-on-surface">{s.label}</span>
          </span>
          <span className="font-mono-sm text-mono-sm text-on-surface-variant">{s.value}%</span>
        </li>
      ))}
    </ul>
  );
}
