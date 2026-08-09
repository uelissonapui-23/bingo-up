import { useParams } from 'react-router-dom'

export function PublicPanelPlaceholderPage() {
  const { publicToken } = useParams()
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-white">
      <section className="w-full max-w-5xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">Painel público</p>
        <h1 className="mt-4 text-5xl font-black sm:text-7xl">Estrutura preparada</h1>
        <p className="mt-5 text-lg text-slate-300">A rota pública é independente da área administrativa e será conectada ao Realtime no módulo correspondente.</p>
        <p className="mt-4 text-xs text-slate-500">Sessão: {publicToken ?? 'sem-token'}</p>
      </section>
    </main>
  )
}
