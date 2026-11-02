import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)

// Register the service worker (production only) so the app is installable
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ }) })
}
