/**
 * Tiny className combiner (clsx-lite). Filters falsy values and joins with spaces.
 * Keeps the bundle dependency-free while staying ergonomic.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Format a number as USD currency, no decimals for compact display. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format large numbers compactly, e.g. 4200 -> 4.2k. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** Thousands-separated integer, e.g. 1284 -> "1,284". */
export function fmtInt(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** USD currency, no decimals. */
export function fmtMoney(value: number): string {
  return formatCurrency(value);
}

/** Up to two initials from a name, e.g. "Alex Morgan" -> "AM". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Short clock time from an ISO timestamp, e.g. "09:42". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Relative day label from an ISO timestamp, e.g. "Today", "Yesterday", "Jul 8". */
const DAY_MS = 86_400_000;
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < DAY_MS) return 'Today';
  if (diff < 2 * DAY_MS) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
