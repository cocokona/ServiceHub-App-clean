import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  avatarUrl?: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('name, role, is_admin, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    return data;
  } catch {
    // Resilient to the is_admin column being absent before migration 00015.
    return null;
  }
}

function toUser(userId: string, email: string, profile: any | null): AdminUser {
  return {
    id: userId,
    email,
    name: profile?.name || email || 'User',
    role: profile?.role || 'customer',
    isAdmin: !!profile?.is_admin,
    avatarUrl: profile?.avatar_url || undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (active) setUser(toUser(session.user.id, session.user.email || '', profile));
      }
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        setUser(toUser(session.user.id, session.user.email || '', profile));
      } else {
        setUser(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin: !!user?.isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
