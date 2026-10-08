import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { runSelfCheck } from './domain/selfcheck'
import './index.css'

if (import.meta.env.DEV) {
  const errors = runSelfCheck()
  if (errors.length) console.error('Проверка модели', errors)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
