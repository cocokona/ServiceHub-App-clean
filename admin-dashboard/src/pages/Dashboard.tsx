import { useMemo, useState } from 'react';
import {
  ShoppingBag,
  DollarSign,
  Users,
  Star,
  MoreVertical,
  Filter,
  RefreshCw,
} from 'lucide-react';
import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import DataTable, { type Column } from '../components/ui/DataTable';
import LineChart from '../components/charts/LineChart';
import ProgressBar from '../components/charts/ProgressBar';
import { useQuery } from '../hooks/useQuery';
import {
  getDashboardStats,
  getOrderTrend,
  getTechnicians,
  getOrders,
} from '../data/queries';
import { STATUS_META, type DashboardOrder } from '../data/types';
import { LoadingBlock, ErrorState, EmptyState } from '../components/feedback/States';
import { fmtInt, fmtMoney } from '../lib/utils';

const PERIODS = ['Daily', 'Weekly', 'Monthly'] as const;
type Period = (typeof PERIODS)[number];

function trendDays(p: Period): number {
  if (p === 'Daily') return 7;
  if (p === 'Monthly') return 30;
  return 14;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('Weekly');

  const stats = useQuery(getDashboardStats, []);
  const trend = useQuery(() => getOrderTrend(trendDays(period)), [period]);
  const techs = useQuery(getTechnicians, []);
  const orders = useQuery(getOrders, []);

  const refreshAll = () => {
    stats.refetch();
    trend.refetch();
    techs.refetch();
    orders.refetch();
  };

  const recentOrders = useMemo(() => (orders.data ?? []).slice(0, 6), [orders.data]);
  const topTechs = useMemo(() => (techs.data ?? []).slice(0, 4), [techs.data]);

  const columns: Column<DashboardOrder>[] = [
    { key: 'code', header: 'Order', render: (o) => <span className="font-mono-sm">{o.code}</span> },
    { key: 'customer', header: 'Customer' },
    { key: 'service', header: 'Service' },
    { key: 'technician', header: 'Technician' },
    {
      key: 'status',
      header: 'Status',
      render: (o) => <Badge tone={STATUS_META[o.status].tone} dot>{STATUS_META[o.status].label}</Badge>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (o) => <span className="font-mono-sm">{o.amount ? `$${o.amount}` : '—'}</span>,
    },
  ];

  return (
    <div className="space-y-lg">
      {/* Page header */}
      <div className="flex flex-col gap-md md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Operations Overview</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Real-time pulse of the ServiceHub platform.
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

      {/* KPI row */}
      {stats.loading && <LoadingBlock label="Loading metrics…" />}
      {stats.error && <ErrorState message={stats.error} onRetry={stats.refetch} />}
      {stats.data && (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Orders"
            value={fmtInt(stats.data.totalOrders)}
            delta={stats.data.ordersDeltaPct ?? undefined}
            icon={<ShoppingBag className="h-5 w-5" />}
            hint="vs last week"
          />
          <StatCard
            label="Revenue"
            value={fmtMoney(stats.data.revenue)}
            delta={stats.data.revenueDeltaPct ?? undefined}
            icon={<DollarSign className="h-5 w-5" />}
            hint="completed jobs"
          />
          <StatCard
            label="Active Customers"
            value={fmtInt(stats.data.customers)}
            delta={stats.data.customersDeltaPct ?? undefined}
            icon={<Users className="h-5 w-5" />}
            hint="vs last week"
          />
          <StatCard
            label="Avg. Rating"
            value={stats.data.avgRating ? stats.data.avgRating.toFixed(1) : '—'}
            icon={<Star className="h-5 w-5" />}
            hint="technicians"
          />
        </div>
      )}

      {/* Charts + table */}
      <div className="grid grid-cols-1 gap-md xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Order Volume Trend"
          action={
            <button className="text-on-surface-variant hover:text-on-surface" aria-label="More">
              <MoreVertical className="h-5 w-5" />
            </button>
          }
        >
          {trend.loading && <LoadingBlock />}
          {trend.error && <ErrorState message={trend.error} onRetry={trend.refetch} />}
          {trend.data && trend.data.length > 0 && (
            <LineChart
              data={trend.data.map((p) => p.value)}
              labels={trend.data.map((p) => p.label)}
            />
          )}
          {trend.data && trend.data.length === 0 && !trend.loading && (
            <EmptyState title="No orders yet" desc="New orders will appear here as customers book services." />
          )}
        </Card>

        <Card title="Top Technicians" action={<Filter className="h-4 w-4 text-on-surface-variant" />}>
          {techs.loading && <LoadingBlock />}
          {techs.error && <ErrorState message={techs.error} onRetry={techs.refetch} />}
          {techs.data && topTechs.length > 0 && (
            <div className="flex flex-col gap-md">
              {topTechs.map((t, i) => (
                <ProgressBar
                  key={t.id}
                  value={t.completion}
                  label={t.name}
                  caption={`${t.completion}% · ★ ${t.rating || '—'} (${t.jobsTotal} jobs)`}
                  color={i < 2 ? 'bg-primary-container' : 'bg-tertiary'}
                  delay={i * 0.1}
                />
              ))}
            </div>
          )}
          {techs.data && topTechs.length === 0 && !techs.loading && (
            <EmptyState title="No technicians yet" desc="Technician profiles will appear once seeded." />
          )}
        </Card>
      </div>

      {/* Recent orders */}
      <Card
        title="Recent Orders"
        action={
          <Button variant="secondary" size="sm" onClick={() => (window.location.href = '/orders')}>
            View all
          </Button>
        }
      >
        {orders.loading && <LoadingBlock />}
        {orders.error && <ErrorState message={orders.error} onRetry={orders.refetch} />}
        {orders.data && (
          <DataTable
            columns={columns}
            data={recentOrders}
            rowKey={(o) => o.id}
            emptyMessage="No orders yet."
          />
        )}
      </Card>
    </div>
  );
}
