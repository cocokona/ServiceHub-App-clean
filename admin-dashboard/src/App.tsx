import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { MessageCountProvider } from './context/MessageCountContext';
import AuthGate from './components/AuthGate';
import Button from './components/ui/Button';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import Messages from './pages/Messages';
import Settings from './pages/Settings';

export default function App() {
  const { user, isAdmin, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
      </div>
    );
  }

  // No session → show the Supabase auth gate (real data requires RLS identity).
  if (!user) return <AuthGate />;

  // Admin-only console: technicians / customers are refused with a clear screen.
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-md">
        <div className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface p-lg text-center shadow-popover">
          <ShieldAlert className="mx-auto mb-md h-10 w-10 text-rose-500" />
          <h1 className="font-headline-sm text-headline-sm text-on-surface">Admin access only</h1>
          <p className="mt-sm font-body-sm text-body-sm text-on-surface-variant">
            The ServiceHub Admin Console is restricted to company administrators.
            The account <code className="font-mono-sm text-on-surface">{user.email}</code> does not
            have administrator privileges.
          </p>
          <Button onClick={() => signOut()} className="mt-md w-full justify-center">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MessageCountProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </MessageCountProvider>
  );
}
