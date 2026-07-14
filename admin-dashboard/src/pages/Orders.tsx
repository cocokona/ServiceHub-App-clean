import { useMemo, useState } from 'react';
import { Search, Filter, Download, Eye, MoreHorizontal, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import DataTable, { type Column } from '../components/ui/DataTable';
import { useQuery } from '../hooks/useQuery';
import { getOrders } from '../data/queries';
import { STATUS_META, type DashboardOrder, type JobStatus } from '../data/types';
import { LoadingBlock, ErrorState, EmptyState } from '../components/feedback/States';
import { cn } from '../lib/utils';

type FilterKey = 'all' | JobStatus;

// Statuses that exist in the live data (DB jobs + order_in_progress 'new').
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function Orders() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const q = useQuery(getOrders, []);

  const all = q.data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    all.forEach((o) => (c[o.status] = (c[o.status] || 0) + 1));
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all.filter((o) => {
      const matchStatus = filter === 'all' || o.status === filter;
      const matchQuery =
        !term ||
        o.customer.toLowerCase().includes(term) ||
        o.service.toLowerCase().includes(term) ||
        o.code.toLowerCase().includes(term) ||
        o.technician.toLowerCase().includes(term);
      return matchStatus && matchQuery;
    });
  }, [all, filter, query]);

  const columns: Column<DashboardOrder>[] = [
    { key: 'code', header: 'Order', render: (o) => <span className="font-mono-sm">{o.code}</span> },
    { key: 'customer', header: 'Customer' },
    { key: 'service', header: 'Service' },
    { key: 'technician', header: 'Technician' },
    { key: 'location', header: 'Location', className: 'hidden md:table-cell' },
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
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: () => (
        <div className="flex items-center justify-end gap-xs">
          <button className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high" aria-label="View">
            <Eye className="h-4 w-4" />
          </button>
          <button className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high" aria-label="More">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-lg">
      <div className="flex flex-col gap-md md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Order Management</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Track, filter, and dispatch service requests.
          </p>
        </div>
        <div className="flex items-center gap-xs">
          <Button variant="secondary" onClick={q.refetch} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="secondary">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card bodyClassName="p-md">
        <div className="flex flex-col gap-md lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex items-center sm:w-72">
            <Search className="pointer-events-none absolute left-2 h-[18px] w-[18px] text-on-surface-variant" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded border border-outline-variant bg-surface-container-low py-1 pl-xl pr-sm font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Search customer, service, ID…"
              aria-label="Search orders"
            />
          </div>
          <div className="flex items-center gap-xs overflow-x-auto scroll-thin">
            <Filter className="hidden h-4 w-4 shrink-0 text-on-surface-variant sm:block" />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'shrink-0 rounded-full px-md py-1 font-label-md text-label-md transition-colors',
                  filter === f.key
                    ? 'bg-primary-container text-white'
                    : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low',
                )}
              >
                {f.label}
                {counts[f.key] !== undefined && (
                  <span className="ml-xs opacity-70">({counts[f.key]})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {q.loading && <LoadingBlock label="Loading orders…" />}
      {q.error && <ErrorState message={q.error} onRetry={q.refetch} />}
      {q.data && (
        <Card title={`${filtered.length} orders`} bodyClassName="p-0">
          {filtered.length === 0 ? (
            <div className="p-lg">
              <EmptyState
                title="No matching orders"
                desc="Try a different filter or search term. New orders appear as customers book."
              />
            </div>
          ) : (
            <DataTable columns={columns} data={filtered} rowKey={(o) => o.id} />
          )}
        </Card>
      )}
    </div>
  );
}
