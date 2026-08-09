import { registerSW } from 'virtual:pwa-register'

let updateAvailable = false
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null

export function registerPwa() {
  updateServiceWorker = registerSW({
    immediate: true,
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
