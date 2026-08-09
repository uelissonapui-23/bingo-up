import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useRuntimeConfig } from '@/app/providers/EnvProvider'

const foundations = [
  ['React + Vite + TypeScript', 'Configurado'],
  ['PWA instalável', 'Configurado'],
  ['Tailwind responsivo', 'Configurado'],
  ['Router e módulos', 'Configurado'],
  ['Supabase client', 'Preparado'],
  ['Multi-tenant / RLS base', 'Preparado'],
  ['Design system inicial', 'Configurado'],
  ['Tratamento global de erros', 'Configurado'],
  ['Vitest + Playwright', 'Configurado'],
  ['Vercel SPA/PWA', 'Configurado']
] as const

export function FoundationPage() {
  const env = useRuntimeConfig()

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Plano Mestre · Módulo 0</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Fundação técnica concluída</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Base preparada para evoluir módulo por módulo sem reconstruir arquitetura, responsividade, isolamento ou infraestrutura.
        </p>
      </section>

      {!env.supabaseConfigured && (
        <Card className="border-amber-200 bg-amber-50/50">
          <StatusBadge tone="warning">Configuração pendente</StatusBadge>
          <h2 className="mt-3 text-lg font-bold">Conecte seu projeto Supabase quando formos publicar.</h2>
          <p className="mt-1 text-sm text-slate-600">Copie <code>.env.example</code> para <code>.env.local</code> e preencha URL e Publishable Key. O projeto abre mesmo sem essas credenciais.</p>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {foundations.map(([name, status]) => (
          <Card key={name} className="flex items-center justify-between gap-4 p-4">
            <span className="font-semibold">{name}</span>
            <StatusBadge tone="success">{status}</StatusBadge>
          </Card>
        ))}
      </section>

      <Card>
        <h2 className="text-xl font-bold">Arquitetura prevista</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric title="Plataforma" value="Multi-tenant" />
          <Metric title="Eventos" value="Múltiplos" />
          <Metric title="Dispositivos" value="Mobile · Tablet · PC · TV" />
        </div>
      </Card>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-1 font-bold">{value}</p></div>
}
