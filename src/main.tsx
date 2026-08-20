import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installPlannerSync } from './lib/supabaseSync'
import { installTheme } from './lib/theme'

installTheme()
installPlannerSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
