import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CacheBreakEvenPage } from './components/CacheBreakEvenPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CacheBreakEvenPage />
  </StrictMode>,
)
