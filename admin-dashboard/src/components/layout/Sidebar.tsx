import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  Settings,
  Plus,
  Building2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMessageCount } from '../../context/MessageCountContext';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When true, the badge reflects the live unread-message count. */
  dynamicBadge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/messages', label: 'Messages', icon: MessageSquare, dynamicBadge: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { count } = useMessageCount();
  const unread = count > 0 ? count : null;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden animate-fade-in"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label="Primary"
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col bg-sidebar text-surface-variant transition-[width] duration-200 ease-in-out',
          'md:flex',
          collapsed ? 'md:w-[64px]' : 'md:w-[240px]',
          'w-[240px]',
          mobileOpen ? 'flex translate-x-0 shadow-popover' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between gap-md border-b border-white/10 px-lg py-xl">
          <div className="flex items-center gap-md overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/10">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="truncate font-headline-sm text-headline-sm text-white leading-tight">
                  ServiceHub
                </h1>
                <p className="truncate font-label-sm text-label-sm text-white/50">
                  Admin Console
                </p>
              </div>
            )}
          </div>
          {/* Close button (mobile only) */}
          <button
            className="rounded p-1 text-white/60 hover:bg-white/10 md:hidden"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <div className="flex flex-1 flex-col gap-xs py-md">
          {NAV_ITEMS.map((item) => {
            const badge = item.dynamicBadge ? unread : null;
            return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onCloseMobile}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative mx-md flex items-center gap-md rounded px-md py-sm font-label-md text-label-md transition-colors duration-150',
                  'hover:bg-white/10 hover:text-white',
                  collapsed && 'md:justify-center md:px-0',
                  isActive
                    ? 'border-l-4 border-primary-container bg-white/10 text-white md:border-l-0 md:bg-sidebar-active/30'
                    : 'border-l-4 border-transparent text-surface-variant',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isActive ? 'text-primary-container' : 'text-white/70',
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && badge ? (
                    <span className="ml-auto rounded-full bg-primary-container px-2 py-0.5 font-mono-sm text-mono-sm text-white">
                      {badge}
                    </span>
                  ) : null}
                  {collapsed && badge ? (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary-container" />
                  ) : null}
                </>
              )}
            </NavLink>
            );
          })}
        </div>

        {/* CTA + collapse toggle */}
        <div className="p-md">
          {!collapsed && (
            <button className="mb-sm flex w-full items-center justify-center gap-sm rounded bg-primary-container py-sm px-md font-label-md text-label-md text-white transition-colors hover:bg-primary">
              <Plus className="h-4 w-4" />
              New Order
            </button>
          )}
          <button
            onClick={onToggleCollapse}
            className="hidden w-full items-center justify-center gap-sm rounded px-md py-sm font-label-md text-label-md text-white/60 transition-colors hover:bg-white/10 hover:text-white md:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
