import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted fonts (replaces render-blocking Google Fonts link in index.html)
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
