import { z } from 'zod'

const identificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CPF'), number: z.string().regex(/^\d{11}$/) }),
  z.object({ type: z.literal('CNPJ'), number: z.string().regex(/^\d{14}$/) }),
])

export const createPaymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('card'),
    productId: z.string().min(1).max(64),
    token: z.string().min(1).max(2048),
    paymentMethodId: z.string().min(1).max(100),
    paymentTypeId: z.enum(['credit_card', 'debit_card', 'prepaid_card']),
    installments: z.number().int().min(1).max(24),
    identification: identificationSchema.optional(),
  }),
  z.object({
    method: z.literal('pix'),
    productId: z.string().min(1).max(64),
    identification: identificationSchema,
  }),
])

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const mercadoPagoWebhookSchema = z.object({
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
  id: z.union([z.string(), z.number()]).optional(),
})
