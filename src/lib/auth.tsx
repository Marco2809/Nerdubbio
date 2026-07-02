import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth as phpAuth, type AuthUser } from '@/lib/php/client';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  signInWithGoogle: (credential: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  async function refreshUser() {
    const u = await phpAuth.me();
    setUser(u);
  }

  useEffect(() => {
    phpAuth.me().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    loading,

    async signIn(email, password) {
      try {
        const r = await phpAuth.login(email, password);
        setUser(r.user);
        qc.clear();
        return {};
      } catch (e) {
        return { error: (e as Error).message };
      }
    },

    async signUp(email, password, displayName) {
      try {
        const r = await phpAuth.signup(email, password, displayName);
        setUser(r.user);
        qc.clear();
        return {};
      } catch (e) {
        return { error: (e as Error).message };
      }
    },

    async signInWithGoogle(credential) {
      try {
        const r = await phpAuth.google(credential);
        setUser(r.user);
        qc.clear();
        return {};
      } catch (e) {
        return { error: (e as Error).message };
      }
    },

    async signOut() {
      phpAuth.logout();
      setUser(null);
      qc.clear();
    },

    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
