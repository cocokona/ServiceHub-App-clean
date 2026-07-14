import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { cn } from '../../lib/utils';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/orders': 'Order Management',
  '/analytics': 'Analytics',
  '/messages': 'Messages',
  '/settings': 'Settings',
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const title = TITLES[location.pathname] ?? 'ServiceHub';

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[margin] duration-200 ease-in-out',
          collapsed ? 'md:ml-[64px]' : 'md:ml-[240px]',
        )}
      >
        <Topbar title={title} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 px-margin-mobile py-md md:px-margin-desktop scroll-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
