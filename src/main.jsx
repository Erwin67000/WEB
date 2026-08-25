import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { I18nProvider } from '@texte/I18nProvider.jsx'
import { initPlausible } from './lib/plausible.js'
import './styles/global.css'
import './styles/site.css'
import './styles/bridge.css'

initPlausible()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
