import { z } from 'zod'

export const mercadoPagoWebhookSchema = z.object({
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
  id: z.union([z.string(), z.number()]).optional(),
})
