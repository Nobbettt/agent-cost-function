import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { KeepAlivePage } from './components/KeepAlivePage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KeepAlivePage />
  </StrictMode>,
)
