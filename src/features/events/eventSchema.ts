import { z } from 'zod'

const optionalDateTime = z.string().optional().or(z.literal(''))

export const eventFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use somente letras minúsculas, números e hífens.'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  location_name: z.string().trim().max(160).optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  starts_at: optionalDateTime,
  ends_at: optionalDateTime,
  sales_open_at: optionalDateTime,
  sales_close_at: optionalDateTime,
  default_card_price: z.number().min(0, 'O valor não pode ser negativo.').max(99999999),
}).superRefine((value, ctx) => {
  if (value.starts_at && value.ends_at && new Date(value.ends_at) < new Date(value.starts_at)) {
    ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'O término não pode ser anterior ao início.' })
  }
  if (value.sales_open_at && value.sales_close_at && new Date(value.sales_close_at) < new Date(value.sales_open_at)) {
    ctx.addIssue({ code: 'custom', path: ['sales_close_at'], message: 'O encerramento das vendas não pode ser anterior à abertura.' })
  }
})

export type EventFormValues = z.infer<typeof eventFormSchema>
