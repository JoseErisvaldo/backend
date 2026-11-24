import { z } from 'zod'
import { priceSchema } from './product-price.schema'

export const updateProductSchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(120),
  description: z.string().trim().min(1, 'Informe uma descrição').max(2000),
  price: priceSchema,
  currency: z.string().trim().length(3).toUpperCase(),
}).partial().strict().refine((data) => Object.keys(data).length > 0, {
  message: 'Informe ao menos um campo para atualizar',
})
