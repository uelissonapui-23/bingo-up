import { Component, type ErrorInfo, type PropsWithChildren } from 'react'

type State = { hasError: boolean }

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    void error
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na aplicação.', error, info)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-dvh place-items-center bg-slate-50 p-6">
          <section className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-red-700">Erro inesperado</p>
            <h1 className="mt-2 text-2xl font-bold">A aplicação encontrou um problema.</h1>
            <p className="mt-3 text-slate-600">Tente recarregar a página. Se o problema continuar, volte ao início e repita somente a última ação.</p>
            <button className="mt-5 rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
