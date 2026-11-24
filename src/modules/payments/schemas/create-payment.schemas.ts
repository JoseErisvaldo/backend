import { z } from 'zod'
import { identificationSchema, itemsSchema } from './payment-common.schemas'

export const createPaymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('card'),
    items: itemsSchema,
    token: z.string().min(1).max(2048),
    paymentMethodId: z.string().min(1).max(100),
    paymentTypeId: z.enum(['credit_card', 'debit_card', 'prepaid_card']),
    installments: z.number().int().min(1).max(24),
    identification: identificationSchema.optional(),
  }),
  z.object({
    method: z.literal('pix'),
    items: itemsSchema,
    identification: identificationSchema,
  }),
])

export const paymentIdempotencyKeySchema = z.string().uuid()
