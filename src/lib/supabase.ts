import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

// The planner still starts without Supabase, but logged-in data then stays on this device only.
export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isSupabaseConfigured = supabase !== null;
