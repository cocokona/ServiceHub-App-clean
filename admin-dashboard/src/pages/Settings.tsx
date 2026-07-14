import { useEffect, useState } from 'react';
import { User, Bell, Shield, Building2, CreditCard, Save, Check, Loader2 } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../hooks/useQuery';
import { getOwnProfile, updateOwnProfile } from '../data/queries';
import { LoadingBlock, ErrorState } from '../components/feedback/States';

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'platform', label: 'Platform', icon: Building2 },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'billing', label: 'Billing', icon: CreditCard },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        enabled ? 'bg-primary-container' : 'bg-surface-container-high'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

function Field({
  label,
  value,
  defaultValue,
  onChange,
  readOnly,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  const controlled = onChange !== undefined;
  return (
    <label className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      <input
        {...(controlled ? { value: value ?? '' } : { defaultValue: defaultValue ?? value ?? '' })}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        className={cn(
          'h-9 rounded border border-outline-variant bg-surface-container-low px-md font-body-sm text-body-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary',
          readOnly && 'cursor-not-allowed opacity-70'
        )}
      />
    </label>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('profile');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [toggles, setToggles] = useState({
    emailOrders: true,
    pushAssign: true,
    weeklyReport: false,
    twoFactor: true,
  });

  const profileQ = useQuery(getOwnProfile, []);
  const [form, setForm] = useState({ name: '', phone: '', city: '' });

  // Sync form from loaded profile (once).
  useEffect(() => {
    if (profileQ.data) {
      setForm({
        name: profileQ.data.name,
        phone: profileQ.data.phone ?? '',
        city: profileQ.data.city ?? '',
      });
    }
  }, [profileQ.data]);

  const set = (k: keyof typeof toggles) => {
    setToggles((t) => ({ ...t, [k]: !t[k] }));
    setSaved(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveErr(null);
    setSaved(false);
    try {
      await updateOwnProfile({ name: form.name, phone: form.phone, city: form.city });
      setSaved(true);
      profileQ.refetch();
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setSaveErr(err?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">System Settings</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Manage your admin profile and platform configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[220px_1fr]">
        {/* Tabs */}
        <nav aria-label="Settings sections" className="flex gap-xs overflow-x-auto lg:flex-col scroll-thin">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex shrink-0 items-center gap-md rounded px-md py-sm font-label-md text-label-md transition-colors lg:w-full',
                tab === t.key
                  ? 'bg-primary-fixed text-on-primary-fixed-variant'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        {/* Panel */}
        <div className="space-y-md">
          {tab === 'profile' && (
            <Card title="Admin Profile">
              {profileQ.loading && <LoadingBlock label="Loading profile…" />}
              {profileQ.error && <ErrorState message={profileQ.error} onRetry={profileQ.refetch} />}
              {profileQ.data && (
                <>
                  <div className="flex items-center gap-md border-b border-outline-variant pb-md">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant font-headline-sm text-headline-sm">
                      {(form.name || user?.name || 'A')
                        .split(/\s+/)
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div>
                      <p className="font-headline-sm text-headline-sm text-on-surface">
                        {form.name || 'Administrator'}
                      </p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant capitalize">
                        {profileQ.data.role}
                        {user?.isAdmin ? ' · admin' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-md pt-md sm:grid-cols-2">
                    <Field label="Full name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                    <Field label="Email" value={profileQ.data.email} readOnly />
                    <Field
                      label="Phone"
                      value={form.phone}
                      onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    />
                    <Field
                      label="City"
                      value={form.city}
                      onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                    />
                  </div>
                </>
              )}
            </Card>
          )}

          {tab === 'platform' && (
            <Card title="Platform Configuration">
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                <Field label="Platform name" defaultValue="ServiceHub" />
                <Field label="Support email" defaultValue="support@servicehub.io" />
                <Field label="Default currency" defaultValue="USD" />
                <Field label="Service area" defaultValue="New York Metro" />
              </div>
            </Card>
          )}

          {tab === 'notifications' && (
            <Card title="Notification Preferences">
              <ul className="divide-y divide-outline-variant/60">
                <Row label="Email on new orders" desc="Get an email when a customer places an order." on={toggles.emailOrders} set={() => set('emailOrders')} />
                <Row label="Push on technician assign" desc="Notify when an order is auto-assigned." on={toggles.pushAssign} set={() => set('pushAssign')} />
                <Row label="Weekly summary report" desc="Send a Monday morning performance digest." on={toggles.weeklyReport} set={() => set('weeklyReport')} />
              </ul>
            </Card>
          )}

          {tab === 'security' && (
            <Card title="Security">
              <ul className="divide-y divide-outline-variant/60">
                <Row label="Two-factor authentication" desc="Require a second factor for admin sign-in." on={toggles.twoFactor} set={() => set('twoFactor')} />
              </ul>
              <div className="mt-md">
                <Field label="Session timeout (minutes)" defaultValue="30" />
              </div>
            </Card>
          )}

          {tab === 'billing' && (
            <Card title="Billing & Payouts">
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                <Field label="Business name" defaultValue="ServiceHub Inc." />
                <Field label="Tax ID" defaultValue="•••-••-8821" />
                <Field label="Payout method" defaultValue="Bank transfer (ACH)" />
                <Field label="Payout cadence" defaultValue="Weekly (Mon)" />
              </div>
            </Card>
          )}

          {tab === 'profile' && profileQ.data && (
            <div className="flex items-center justify-end gap-md">
              {saveErr && (
                <span className="font-label-md text-label-md text-rose-600">{saveErr}</span>
              )}
              {saved && (
                <span className="flex items-center gap-xs font-label-md text-label-md text-emerald-600">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  desc,
  on,
  set,
}: {
  label: string;
  desc: string;
  on: boolean;
  set: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-md py-md">
      <div>
        <p className="font-body-sm text-body-sm text-on-surface">{label}</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{desc}</p>
      </div>
      <Toggle enabled={on} onChange={set} />
    </li>
  );
}
