import { cn } from '../../lib/utils';

export interface BarSeries {
  label: string;
  values: number[]; // raw values (e.g. dollars or counts)
  color: string; // tailwind bg class
}

interface BarChartProps {
  series: BarSeries[];
  labels: string[];
  height?: number;
  /** Formats a raw value for tooltips + Y-axis ticks (e.g. currency). */
  format?: (v: number) => string;
}

/** Build numeric Y-axis ticks from the max value (top → 0). */
function buildTicks(max: number): number[] {
  const step = max / 4 || 1;
  return [max, step * 3, step * 2, step, 0];
}

export default function BarChart({ series, labels, height = 260, format }: BarChartProps) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = buildTicks(max);
  const fmt = (v: number) => (format ? format(v) : String(Math.round(v)));

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Y axis */}
      <div className="absolute -left-1 top-0 flex h-full flex-col justify-between py-sm text-right font-mono-sm text-mono-sm text-on-surface-variant w-12">
        {ticks.map((t) => (
          <span key={t}>{fmt(t)}</span>
        ))}
      </div>
      <div className="absolute inset-0 ml-12 flex items-end justify-between gap-2 border-b border-l border-outline-variant px-md pb-xl pt-lg">
        {labels.map((label, i) => (
          <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-1">
              {series.map((s) => (
                <div
                  key={s.label}
                  title={`${s.label}: ${fmt(s.values[i])}`}
                  className={cn('w-1/2 max-w-[22px] rounded-t-sm', s.color, 'animate-bar-grow')}
                  style={{ height: `${Math.max(2, (s.values[i] / max) * 100)}%` }}
                />
              ))}
            </div>
            <span className="absolute -bottom-6 font-mono-sm text-mono-sm text-on-surface-variant">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
