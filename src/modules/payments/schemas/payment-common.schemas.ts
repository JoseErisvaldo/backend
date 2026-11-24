import { z } from 'zod'

export const identificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CPF'), number: z.string().regex(/^\d{11}$/) }),
  z.object({ type: z.literal('CNPJ'), number: z.string().regex(/^\d{14}$/) }),
])

export const itemsSchema = z.array(
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

export const paymentIdSchema = z.string().uuid()
