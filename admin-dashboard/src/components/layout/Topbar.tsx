import { useState } from 'react';
import { Menu, Search, Bell, HelpCircle, LifeBuoy, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../lib/utils';

interface TopbarProps {
  title: string;
  onOpenMobile: () => void;
}

export default function Topbar({ title, onOpenMobile }: TopbarProps) {
  const { user, signOut } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-outline-variant bg-surface px-lg">
      <div className="flex items-center gap-md">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high md:hidden"
          onClick={onOpenMobile}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      </div>

      <div className="flex items-center gap-md">
        {/* Search */}
        <div className="relative hidden items-center sm:flex">
          <Search className="pointer-events-none absolute left-2 h-[18px] w-[18px] text-on-surface-variant" />
          <input
            className="h-8 w-64 rounded border border-outline-variant bg-surface-container-low py-1 pl-xl pr-sm font-body-sm text-body-sm text-on-surface transition-all placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Search orders, customers..."
            aria-label="Search"
          />
        </div>

        {/* Trailing actions */}
        <div className="flex items-center gap-sm">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
            aria-label="Apps"
          >
            <LifeBuoy className="h-5 w-5" />
          </button>

          {/* Live data indicator + notifications */}
          <div className="relative">
            <button
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary-container ring-2 ring-surface" />
            </button>
            {notifOpen && (
              <div
                className="absolute right-0 top-10 w-72 animate-fade-in rounded-lg border border-outline-variant bg-surface p-md shadow-popover"
                role="menu"
              >
                <p className="font-label-md text-label-md text-on-surface-variant">
                  <span className="mr-xs inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
                  Live connection to ServiceHub Supabase. Data refreshes on every load.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="hidden h-4 w-px bg-outline-variant sm:block" />

        {/* Account menu (real authenticated user) */}
        {user && (
          <div className="relative">
            <button
              className="flex items-center gap-xs rounded-full py-0.5 pl-0.5 pr-1 transition-colors hover:bg-surface-container-high"
              aria-label="Account menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md">
                {initials(user.name)}
              </span>
              <span className="hidden font-label-md text-label-md text-on-surface sm:block">
                {user.name}
              </span>
              {user.isAdmin && (
                <span className="hidden rounded-full bg-primary-container/15 px-2 py-0.5 font-label-sm text-label-sm text-primary-container sm:block">
                  Admin
                </span>
              )}
              <ChevronDown className="hidden h-4 w-4 text-on-surface-variant sm:block" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-10 w-56 rounded-lg border border-outline-variant bg-surface shadow-popover"
                role="menu"
              >
                <div className="border-b border-outline-variant px-md py-sm">
                  <p className="truncate font-body-sm text-body-sm text-on-surface">{user.name}</p>
                  <p className="truncate font-label-sm text-label-sm text-on-surface-variant">
                    {user.email}
                  </p>
                  <p className="mt-xs font-label-sm text-label-sm capitalize text-on-surface-variant">
                    {user.role}
                    {user.isAdmin ? ' · admin' : ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-xs px-md py-sm font-label-md text-label-md text-rose-600 transition-colors hover:bg-surface-container-low"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
