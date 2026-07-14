import { useState } from 'react';
import { AlertCircle, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

/**
 * Full-screen Supabase Auth gate. The Admin Console is ADMIN-ONLY: only
 * accounts with profiles.is_admin = true (seeded via migration 00016) may pass.
 * Technician / customer logins are rejected by App.tsx after authentication.
 */
export default function AuthGate() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  if (loading) {
    return (
      <FullCenter>
        <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
      </FullCenter>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalErr(null);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setLocalErr(err?.message || 'Sign in failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FullCenter>
      <div className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface p-lg shadow-popover">
        <div className="mb-md flex items-center gap-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-headline-sm text-headline-sm text-on-surface">ServiceHub Admin</h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-md">
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 rounded border border-outline-variant bg-surface-container-low px-md font-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="you@servicehub.io"
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 rounded border border-outline-variant bg-surface-container-low px-md font-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {localErr && (
            <div
              className="flex items-start gap-xs rounded border border-rose-300 bg-rose-50 px-md py-sm text-rose-700"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="font-label-sm text-label-sm">{localErr}</span>
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full justify-center">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Sign in
          </Button>
        </form>

        <p className="mt-md font-label-sm text-label-sm text-on-surface-variant">
          Restricted to company administrators. Use the admin account provisioned via
          migration <code>00016</code> (or your SSO/admin directory).
        </p>
      </div>
    </FullCenter>
  );
}

function FullCenter({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background px-md">{children}</div>;
}
