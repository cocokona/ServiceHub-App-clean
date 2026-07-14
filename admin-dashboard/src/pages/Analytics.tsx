import { useState } from 'react';
import { MoreVertical, Filter, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import ProgressBar from '../components/charts/ProgressBar';
import DonutChart, { DonutLegend } from '../components/charts/DonutChart';
import { useQuery } from '../hooks/useQuery';
import { getOrderTrend, getRevenueByMonth, getTechnicians, getCustomerActivity } from '../data/queries';
import { LoadingBlock, ErrorState, EmptyState } from '../components/feedback/States';
import { fmtMoney } from '../lib/utils';

const PERIODS = ['Daily', 'Weekly', 'Monthly'] as const;

export default function Analytics() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('Monthly');

  const trend = useQuery(() => getOrderTrend(period === 'Monthly' ? 30 : period === 'Daily' ? 7 : 14), [period]);
  const revenue = useQuery(() => getRevenueByMonth(6), []);
  const techs = useQuery(getTechnicians, []);
  const activity = useQuery(getCustomerActivity, []);

  const refreshAll = () => {
    trend.refetch();
    revenue.refetch();
    techs.refetch();
    activity.refetch();
  };

  const totalCustomers = activity.data?.reduce((a, s) => a + s.value, 0) ?? 0;

  return (
    <div className="space-y-lg">
      <div className="flex flex-col gap-md md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Data Analysis &amp; Visualization</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Overview of key performance metrics.
          </p>
        </div>
        <div className="flex items-center gap-xs">
          <div className="flex items-center rounded bg-surface border border-outline-variant p-xs">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  'rounded px-md py-1 font-label-md text-label-md transition-colors ' +
                  (period === p
                    ? 'bg-surface-container-high text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container-low')
                }
              >
                {p}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={refreshAll} aria-label="Refresh data">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-md xl:grid-cols-2">
        {/* Order Volume Trends (line) */}
        <Card
          title="Order Volume Trends"
          action={
            <button className="text-on-surface-variant hover:text-on-surface" aria-label="More">
              <MoreVertical className="h-5 w-5" />
            </button>
          }
        >
          {trend.loading && <LoadingBlock />}
          {trend.error && <ErrorState message={trend.error} onRetry={trend.refetch} />}
          {trend.data && trend.data.length > 0 && (
            <LineChart data={trend.data.map((p) => p.value)} labels={trend.data.map((p) => p.label)} />
          )}
          {trend.data && trend.data.length === 0 && !trend.loading && (
            <EmptyState title="No order data" />
          )}
        </Card>

        {/* Revenue Statistics (bar) */}
        <Card
          title="Revenue Statistics"
          action={
            <div className="flex items-center gap-sm">
              <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                <span className="h-2 w-2 rounded-full bg-primary-container" /> Completed
              </span>
              <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
                <span className="h-2 w-2 rounded-full bg-tertiary" /> New Orders
              </span>
            </div>
          }
        >
          {revenue.loading && <LoadingBlock />}
          {revenue.error && <ErrorState message={revenue.error} onRetry={revenue.refetch} />}
          {revenue.data && revenue.data.labels.length > 0 && (
            <BarChart
              labels={revenue.data.labels}
              format={(v) => fmtMoney(v)}
              series={[
                { label: 'Completed', values: revenue.data.completed, color: 'bg-primary-container' },
                { label: 'New Orders', values: revenue.data.fresh, color: 'bg-tertiary' },
              ]}
            />
          )}
          {revenue.data && revenue.data.labels.length === 0 && !revenue.loading && (
            <EmptyState title="No revenue data yet" />
          )}
        </Card>

        {/* Technician Performance (horizontal bars) */}
        <Card title="Technician Performance" action={<Badge tone="info">Top {techs.data?.length ?? 0}</Badge>}>
          {techs.loading && <LoadingBlock />}
          {techs.error && <ErrorState message={techs.error} onRetry={techs.refetch} />}
          {techs.data && techs.data.length > 0 && (
            <div className="flex flex-col justify-center gap-md py-sm">
              {techs.data.map((t, i) => (
                <ProgressBar
                  key={t.id}
                  value={t.completion}
                  label={t.name}
                  caption={`${t.completion}% completion · ★ ${t.rating || '—'} · ${t.jobsTotal} jobs`}
                  color={i < 2 ? 'bg-primary-container' : 'bg-tertiary'}
                  delay={i * 0.1}
                />
              ))}
            </div>
          )}
          {techs.data && techs.data.length === 0 && !techs.loading && (
            <EmptyState title="No technicians yet" />
          )}
        </Card>

        {/* Customer Activity (donut) */}
        <Card
          title="Customer Activity"
          action={
            <button className="text-on-surface-variant hover:text-on-surface" aria-label="Filter">
              <Filter className="h-5 w-5" />
            </button>
          }
        >
          {activity.loading && <LoadingBlock />}
          {activity.error && <ErrorState message={activity.error} onRetry={activity.refetch} />}
          {activity.data && activity.data.length > 0 && (
            <div className="flex flex-col items-center gap-xl py-sm sm:flex-row sm:justify-center">
              <DonutChart segments={activity.data} centerValue={`${totalCustomers}%`} centerLabel="Segmented" />
              <DonutLegend segments={activity.data} />
            </div>
          )}
          {activity.data && activity.data.length === 0 && !activity.loading && (
            <EmptyState title="No customer data yet" />
          )}
        </Card>
      </div>
    </div>
  );
}
