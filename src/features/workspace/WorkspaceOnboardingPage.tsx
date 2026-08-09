import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { createWorkspace } from './workspaceService'
import { useWorkspace } from '@/app/providers/WorkspaceProvider'
import { toSlug } from '@/utils/slug'

export function WorkspaceOnboardingPage() {
  const { currentWorkspace, refresh, loading } = useWorkspace()
  const [name, setName] = useState('')
  const [slugOverride, setSlugOverride] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const slug = slugOverride ?? toSlug(name)

  if (!loading && currentWorkspace) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) {
      setError('Informe o nome do organizador.')
      return
    }

    if (!slug) {
      setError('Informe um identificador válido.')
      return
    }

    setBusy(true)
    try {
      await createWorkspace(name, slug)
      await refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(
        message.includes('already')
          ? 'Este identificador já está em uso. Tente outro.'
          : 'Não foi possível criar o espaço do organizador.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold text-emerald-700">Configuração inicial</p>
          <h1 className="mt-1 text-2xl font-bold">Crie o espaço do organizador</h1>
          <p className="mt-2 text-sm text-slate-600">
            Este será o ambiente onde ficarão os eventos, cartelas, vendas e sorteios. A estrutura já está isolada para permitir expansão futura.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Nome do organizador
              <Input
                className="mt-1"
                placeholder="Ex.: Associação Beneficente Central"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Identificador
              <Input
                className="mt-1"
                value={slug}
                onChange={(event) => setSlugOverride(toSlug(event.target.value))}
                required
              />
            </label>

            <p className="text-xs text-slate-500">
              Usado internamente e em endereços futuros. Pode ser alterado depois, desde que continue único.
            </p>

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <Button disabled={busy}>{busy ? 'Criando...' : 'Criar espaço e continuar'}</Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
