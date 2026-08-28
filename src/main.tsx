import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installPlannerSync } from './lib/supabaseSync'

installPlannerSync()

// Keep the already-visited planner usable without a connection.  Supabase is
// deliberately not cached here: planner data remains owned by Dexie + the
// normal sync layer, rather than a browser HTTP cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => undefined)
  }, { once: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
