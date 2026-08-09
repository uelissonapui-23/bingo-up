import type { BingoEvent, EventStatus } from '@/types/database'

export const eventStatusLabel: Record<EventStatus, string> = {
  draft: 'Rascunho', sales_open: 'Vendas abertas', sales_paused: 'Vendas pausadas', ready: 'Pronto',
  drawing: 'Sorteio em andamento', paused: 'Sorteio pausado', finished: 'Finalizado', canceled: 'Cancelado', archived: 'Arquivado',
}

export function eventStatusTone(status: EventStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'sales_open' || status === 'drawing') return 'success'
  if (status === 'sales_paused' || status === 'paused' || status === 'ready') return 'warning'
  return 'neutral'
}

export function toLocalDateTimeInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

export function formatEventDate(value: string | null) {
  if (!value) return 'Data ainda não definida'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function canEditEvent(event: BingoEvent) {
  return event.status !== 'archived'
}
