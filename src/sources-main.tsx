import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SourcesPage } from './components/SourcesPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SourcesPage />
  </StrictMode>,
)
