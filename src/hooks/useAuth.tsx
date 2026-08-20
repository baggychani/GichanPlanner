import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { subscribePlannerSync, syncPlannerWithCloud } from '../lib/supabaseSync';
import { authErrorMessage } from '../components/authUi';

type AuthValue = {
  session: Session | null;
  isLoading: boolean;
  isSyncing: boolean;
  syncError: string | null;
  retrySync: () => void;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  isLoading: Boolean(supabase),
  isSyncing: false,
  syncError: null,
  retrySync: () => {},
  isPasswordRecovery: false,
  clearPasswordRecovery: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => subscribePlannerSync(error => {
    setSyncError(error ? authErrorMessage(error) : null);
  }), []);

  useEffect(() => {
    if (!session) {
      setIsSyncing(false);
      return;
    }
    let cancelled = false;
    const run = () => {
      setIsSyncing(true);
      void syncPlannerWithCloud()
        .catch(() => {})
        .finally(() => { if (!cancelled) setIsSyncing(false); });
    };
    run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    const onOnline = () => { run(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [session?.user.id]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isSyncing,
        syncError,
        retrySync: () => { void syncPlannerWithCloud().catch(() => {}); },
        isPasswordRecovery,
        clearPasswordRecovery: () => setIsPasswordRecovery(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
