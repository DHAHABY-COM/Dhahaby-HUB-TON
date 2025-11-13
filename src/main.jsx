import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TonConnectUIProvider manifestUrl="https://dhahaby-ton.topy.ai/tonconnect-manifest.json">
    <App />
    </TonConnectUIProvider>
  </StrictMode>
)
