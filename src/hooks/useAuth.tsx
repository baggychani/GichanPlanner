import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { localAccountNeedsCloudHydration, prepareLocalAccount, subscribePlannerSync, syncPlannerWithCloud } from '../lib/supabaseSync';
import { authErrorMessage } from '../components/authUi';

type AuthValue = {
  session: Session | null;
  isLoading: boolean;
  accountReady: boolean;
  isSyncing: boolean;
  syncError: string | null;
  retrySync: () => void;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  isLoading: Boolean(supabase),
  accountReady: true,
  isSyncing: false,
  syncError: null,
  retrySync: () => {},
  isPasswordRecovery: false,
  clearPasswordRecovery: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [accountReady, setAccountReady] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const sawInitialSession = useRef(false);
  const pendingLoginSync = useRef(false);

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
      if (event === 'INITIAL_SESSION') sawInitialSession.current = true;
      if (event === 'SIGNED_IN' && sawInitialSession.current) pendingLoginSync.current = true;
      if (event === 'SIGNED_OUT') pendingLoginSync.current = false;
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => subscribePlannerSync(error => {
    setSyncError(error ? authErrorMessage(error) : null);
  }), []);

  useEffect(() => {
    if (!session) {
      setAccountReady(true);
      setIsSyncing(false);
      return;
    }
    let cancelled = false;
    const hydrateFromCloud = localAccountNeedsCloudHydration(session.user.id);
    const announce = hydrateFromCloud || pendingLoginSync.current;
    pendingLoginSync.current = false;
    if (hydrateFromCloud) setAccountReady(false);
    else setAccountReady(true);

    const run = (showStatus: boolean) => {
      if (showStatus) setIsSyncing(true);
      void prepareLocalAccount(session.user.id)
        .then(() => {
          if (!cancelled) setAccountReady(true);
          return syncPlannerWithCloud();
        })
        .catch(() => {})
        .finally(() => { if (!cancelled && showStatus) setIsSyncing(false); });
    };
    run(announce);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncPlannerWithCloud().catch(() => {});
    };
    const onOnline = () => { void syncPlannerWithCloud().catch(() => {}); };
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
        accountReady,
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
