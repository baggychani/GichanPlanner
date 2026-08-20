import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

export const isSupabaseConfigured = supabase !== null;

export function authRedirectTo() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}
