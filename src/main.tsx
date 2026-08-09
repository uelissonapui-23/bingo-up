import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { registerPwa } from '@/pwa/register'
import '@/styles/index.css'

registerPwa()

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
