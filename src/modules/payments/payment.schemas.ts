import { z } from 'zod'

const identificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CPF'), number: z.string().regex(/^\d{11}$/) }),
  z.object({ type: z.literal('CNPJ'), number: z.string().regex(/^\d{14}$/) }),
])

const itemsSchema = z.array(
  z.object({
    productId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(99),
  }),
).min(1).max(50).superRefine((items, context) => {
  const productIds = new Set<string>()
  items.forEach((item, index) => {
    if (productIds.has(item.productId)) {
      context.addIssue({
        code: 'custom',
        message: 'Cada produto deve aparecer uma única vez no pedido',
        path: [index, 'productId'],
      })
    }
    productIds.add(item.productId)
  })
})

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

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const listAdminPaymentsQuerySchema = listPaymentsQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  customerName: z.string().trim().max(120).optional(),
  paymentMethod: z.enum(['pix', 'card']).optional(),
  status: z.enum(['paid', 'pending', 'failed', 'cancelled', 'expired']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['createdAt', 'amount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
  { message: 'A data inicial deve ser anterior ou igual à data final', path: ['dateTo'] },
)
export const paymentIdSchema = z.string().uuid()
export const paymentIdempotencyKeySchema = z.string().uuid()

export const mercadoPagoWebhookSchema = z.object({
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
  id: z.union([z.string(), z.number()]).optional(),
})
