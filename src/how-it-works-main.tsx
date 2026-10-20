import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { HowItWorksPage } from './components/HowItWorksPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HowItWorksPage />
  </StrictMode>,
)
