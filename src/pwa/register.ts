import { registerSW } from 'virtual:pwa-register'

let updateAvailable = false
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null

export function registerPwa() {
  // Remove o cache legado que chegou a armazenar respostas autenticadas do Supabase.
  if ('caches' in window) void window.caches.delete('supabase-runtime')
  updateServiceWorker = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const checkForUpdate = () => { if (navigator.onLine) void registration.update() }
      const interval = window.setInterval(checkForUpdate, 60_000)
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('pagehide', () => window.clearInterval(interval), {once:true})
    },
    onNeedRefresh() {
      updateAvailable = true
      window.dispatchEvent(new CustomEvent('bingo:pwa-update'))
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('bingo:pwa-offline-ready'))
    },
  })
}

export function hasPwaUpdate() { return updateAvailable }
export async function applyPwaUpdate() { await updateServiceWorker?.(true) }
