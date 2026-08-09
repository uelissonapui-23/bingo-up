import { useOnlineStatus } from '@/hooks/useOnlineStatus'
export function OfflineBanner() {
  const online = useOnlineStatus()
  return online ? null : <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950">Sem conexão. Alterações online ficam indisponíveis até a conexão voltar.</div>
}
