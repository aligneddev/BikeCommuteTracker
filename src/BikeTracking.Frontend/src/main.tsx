import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializePwaBootstrap } from './services/pwa/bootstrap'
import { registerServiceWorker } from './services/pwa/register-service-worker'

initializePwaBootstrap()
void registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
