import type { ModuleRoute } from '@/app/router/routes'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'

type Props = { route?: ModuleRoute; title?: string }
export function ModulePlaceholderPage({ route, title }: Props) {
  const name = route?.title ?? title ?? 'Módulo'
  return <div className="space-y-5"><section>{route && <StatusBadge>{`Módulo ${String(route.module).padStart(2, '0')}`}</StatusBadge>}<h1 className="mt-3 text-3xl font-black tracking-tight">{name}</h1>{route && <p className="mt-2 text-slate-600">{route.description}</p>}</section><Card><p className="font-semibold">Estrutura preparada para implementação definitiva.</p><p className="mt-2 text-sm text-slate-600">A funcionalidade será ativada na etapa correspondente sem substituir a fundação.</p></Card></div>
}
