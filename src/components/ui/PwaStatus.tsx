import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { applyPwaUpdate, hasPwaUpdate } from '@/pwa/register'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted'|'dismissed' }> }

export function PwaStatus() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [update, setUpdate] = useState(hasPwaUpdate())
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt) }
    const onUpdate = () => setUpdate(true)
    const onOfflineReady = () => { setOfflineReady(true); window.setTimeout(() => setOfflineReady(false), 5000) }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('bingo:pwa-update', onUpdate)
    window.addEventListener('bingo:pwa-offline-ready', onOfflineReady)
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('bingo:pwa-update', onUpdate); window.removeEventListener('bingo:pwa-offline-ready', onOfflineReady) }
  }, [])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt(); const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setInstallPrompt(null)
  }

  if (!installPrompt && !update && !offlineReady) return null
  return <div className="fixed bottom-20 right-4 z-50 w-[min(92vw,390px)] space-y-2 lg:bottom-4">
    {update && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"><p className="font-bold">Nova versão disponível</p><p className="mt-1 text-sm text-slate-600">Atualize quando não estiver no meio de uma operação crítica.</p><Button className="mt-3 w-full" onClick={()=>void applyPwaUpdate()}>Atualizar aplicativo</Button></div>}
    {installPrompt && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"><p className="font-bold">Instalar Bingo PWA</p><p className="mt-1 text-sm text-slate-600">Use como aplicativo no dispositivo, sem depender de uma aba aberta.</p><Button className="mt-3 w-full" variant="secondary" onClick={()=>void install()}>Instalar</Button></div>}
    {offlineReady && <div className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-xl">Aplicativo preparado para abrir mesmo sem conexão.</div>}
  </div>
}
