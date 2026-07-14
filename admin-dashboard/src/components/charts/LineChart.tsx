import { useId } from 'react';
import { cn } from '../../lib/utils';

interface LineChartProps {
  /** Values 0..1 normalized, or raw values (we auto-normalize). */
  data: number[];
  labels?: string[];
  yTicks?: string[];
  height?: number;
  className?: string;
}

export default function LineChart({
  data,
  labels,
  yTicks = ['1k', '750', '500', '250', '0'],
  height = 240,
  className,
}: LineChartProps) {
  const id = useId();
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const n = data.length;

  const pts = data.map((v, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * 100;
    const y = 100 - ((v - min) / span) * 100;
    return [x, y] as const;
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const areaPath = `${linePath} L100,100 L0,100 Z`;

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      {/* Y axis labels */}
      <div className="absolute left-0 top-0 flex h-full flex-col justify-between py-sm pr-xs text-right font-mono-sm text-mono-sm text-on-surface-variant w-8">
        {yTicks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="absolute inset-0 ml-8 chart-grid">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label="Line trend chart"
        >
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tw-primary, #0052ff)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--tw-primary, #0052ff)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#fill-${id})`} stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--tw-primary, #0052ff)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r={1.6}
              className="fill-surface stroke-primary-container"
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      {labels && (
        <div className="absolute bottom-0 left-8 right-0 flex justify-between px-sm font-mono-sm text-mono-sm text-on-surface-variant">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
