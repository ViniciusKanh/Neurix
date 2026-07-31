import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initTheme } from '@/lib/theme'

// Apply the saved accent color before first paint.
initTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
