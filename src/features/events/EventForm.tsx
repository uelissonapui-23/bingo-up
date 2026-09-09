import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { eventFormSchema, type EventFormValues } from './eventSchema'

export function EventForm({ initialValues, onSubmit, submitLabel = 'Salvar evento', busy = false }: {
  initialValues?: Partial<EventFormValues>
  onSubmit: (values: EventFormValues) => Promise<void>
  submitLabel?: string
  busy?: boolean
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: { game_mode:'number_bingo', name: '', slug: '', description: '', location_name: '', address: '', starts_at: '', ends_at: '', sales_open_at: '', sales_close_at: '', default_card_price: 0, ...initialValues },
  })

  useEffect(() => { if (initialValues) reset({ game_mode:'number_bingo', name: '', slug: '', description: '', location_name: '', address: '', starts_at: '', ends_at: '', sales_open_at: '', sales_close_at: '', default_card_price: 0, ...initialValues }) }, [initialValues, reset])

  return <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
    <Field label="Tipo de evento" error={errors.game_mode?.message}><Select {...register('game_mode')} disabled={Boolean(initialValues?.game_mode)}><option value="number_bingo">Bingo tradicional com números</option><option value="raffle">Rifa com números vendidos</option><option value="symbol_bingo">Bingo de símbolos e charadas</option></Select>{initialValues?.game_mode&&<span className="mt-1 block text-xs text-slate-500">O tipo fica bloqueado após a criação para proteger cartelas, vendas e sorteios.</span>}</Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome do evento" error={errors.name?.message}><Input {...register('name')} placeholder="Bingo Beneficente" /></Field>
      <Field label="Identificador" error={errors.slug?.message}><Input {...register('slug')} placeholder="bingo-beneficente" /></Field>
    </div>
    <Field label="Descrição" error={errors.description?.message}><Textarea {...register('description')} placeholder="Informações internas e resumo do evento." /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Local" error={errors.location_name?.message}><Input {...register('location_name')} placeholder="Salão principal" /></Field>
      <Field label="Endereço" error={errors.address?.message}><Input {...register('address')} placeholder="Rua, número, bairro" /></Field>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Início do evento" error={errors.starts_at?.message}><Input type="datetime-local" {...register('starts_at')} /></Field>
      <Field label="Término do evento" error={errors.ends_at?.message}><Input type="datetime-local" {...register('ends_at')} /></Field>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Abertura das vendas" error={errors.sales_open_at?.message}><Input type="datetime-local" {...register('sales_open_at')} /></Field>
      <Field label="Encerramento das vendas" error={errors.sales_close_at?.message}><Input type="datetime-local" {...register('sales_close_at')} /></Field>
    </div>
    <Field label="Valor padrão da cartela" error={errors.default_card_price?.message}><Input type="number" min="0" step="0.01" {...register('default_card_price', { valueAsNumber: true })} /></Field>
    <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : submitLabel}</Button>
  </form>
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}{error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}</label>
}
